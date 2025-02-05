const {
    expect
} = require("chai");
const {
    ethers,
    network
} = require("hardhat");
const {
    anyValue
} = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("DaoParty (обновлённая версия с KYC и NFT, используя NFTPassport)", function () {
    let daoParty, nftPassport, kycManager;
    let owner, verifiedUser, unverifiedUser, otherUser;
    const votingPeriod = 3600; // 1 час
    const KYC_VALIDITY_PERIOD = 2592000; // 30 дней в секундах

    beforeEach(async function () {
    [owner, verifiedUser, unverifiedUser, otherUser] = await ethers.getSigners();

        // Развертывание NFTPassport (контракт для ментинга NFT)
        const NFTPassport = await ethers.getContractFactory("NFTPassport");
        nftPassport = await NFTPassport.deploy();
        await nftPassport.waitForDeployment();
        const nftPassportAddress = await nftPassport.getAddress();
        console.log("NFTPassport deployed at:", nftPassportAddress);

        // Выдаем NFT для verifiedUser (при необходимости другим)
        await nftPassport.mintPassport(verifiedUser.address);

        // Развертывание KYCManager
        const KYCManager = await ethers.getContractFactory("KYCManager");
        // Если конструктор KYCManager требует аргумент (например, адрес владельца), передайте его (здесь, например, owner.address)
        kycManager = await KYCManager.deploy(owner.address);
        await kycManager.waitForDeployment();
        const kycManagerAddress = await kycManager.getAddress();
        console.log("KYCManager deployed at:", kycManagerAddress);

        // Развертывание DaoParty, передавая два аргумента: владельца и адрес KYCManager
        const DaoParty = await ethers.getContractFactory("DaoParty");
        daoParty = await DaoParty.deploy(owner.address, kycManagerAddress);
        await daoParty.waitForDeployment();

        // Установка адреса NFT-контракта в DaoParty
        await daoParty.setNftContract(nftPassportAddress);

        // Верифицируем пользователя через KYCManager с корректными данными:
        // documentType: "ВНУТРЕННИЙ ПАСПОРТ РФ", liveness: true, faceId: "face123"
        await kycManager.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face123");
    });

    describe("Функции администратора", function () {
        it("Должен позволять владельцу установить адрес NFT-контракта и выбросить событие", async function () {
            await expect(daoParty.setNftContract(await nftPassport.getAddress()))
                .to.emit(daoParty, "NftContractUpdated")
                .withArgs(await nftPassport.getAddress());
        });

        it("Должен позволять владельцу обновить статус KYC и выбросить событие", async function () {
            // В данном случае обновление KYC происходит через KYCManager
            await expect(kycManager.updateKyc(unverifiedUser.address, true))
                .to.emit(kycManager, "KycUpdated")
                .withArgs(unverifiedUser.address, true, anyValue, "");
        });

        it("Должен позволять верифицировать пользователя с корректным документом, liveness и FaceID", async function () {
            await expect(
                    kycManager.verifyUser(otherUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face456")
                )
                .to.emit(kycManager, "KycUpdated")
                .withArgs(otherUser.address, true, anyValue, "ВНУТРЕННИЙ ПАСПОРТ РФ");
        });

        it("Должен отклонять верификацию пользователя с некорректным документом", async function () {
            await expect(
                kycManager.verifyUser(otherUser.address, "Заграничный паспорт", true, "face456")
            ).to.be.revertedWith("Only Russian internal passports are allowed");
        });

        it("Должен отклонять верификацию, если liveness check не пройдена", async function () {
            await expect(
                kycManager.verifyUser(otherUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", false, "face456")
            ).to.be.revertedWith("Liveness check failed");
        });

        it("Должен отклонять верификацию, если faceID пустой", async function () {
            await expect(
                kycManager.verifyUser(otherUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "")
            ).to.be.revertedWith("Invalid faceID");
        });
    });

    describe("Проверка требований KYC и NFT", function () {
        it("Должен отклонять создание предложения, если NFT-контракт не установлен", async function () {
            const DaoParty = await ethers.getContractFactory("DaoParty");
            // Развертывание DaoParty без установки NFT-контракта
            const daoPartyNoNFT = await DaoParty.deploy(owner.address, await kycManager.getAddress());
            await daoPartyNoNFT.waitForDeployment();
            // Обновляем KYC для verifiedUser через KYCManager
            await kycManager.updateKyc(verifiedUser.address, true);
            await expect(
                daoPartyNoNFT.connect(verifiedUser).createProposal("Test Proposal", votingPeriod)
            ).to.be.revertedWith("NFT contract not set");
        });

        it("Должен отклонять создание предложения, если вызывающий не владеет NFT", async function () {
            await kycManager.updateKyc(unverifiedUser.address, true);
            await expect(
                daoParty.connect(unverifiedUser).createProposal("Test Proposal", votingPeriod)
            ).to.be.revertedWith("You must own an NFT");
        });

        it("Должен отклонять создание предложения, если KYC не пройден", async function () {
            await nftPassport.mintPassport(otherUser.address);
            await expect(
                daoParty.connect(otherUser).createProposal("Test Proposal", votingPeriod)
            ).to.be.revertedWith("KYC verification required");
        });
    });

    describe("Механизм повторного KYC", function () {
        it("Должен блокировать создание предложения, если срок KYC истёк", async function () {
            await kycManager.updateKyc(verifiedUser.address, true);
            await network.provider.send("evm_increaseTime", [KYC_VALIDITY_PERIOD + 1]);
            await network.provider.send("evm_mine");
            await expect(
                daoParty.connect(verifiedUser).createProposal("Test Proposal after KYC expiry", votingPeriod)
            ).to.be.revertedWith("KYC expired");
        });

        it("Должен разрешать создание предложения после повторного KYC", async function () {
            await kycManager.updateKyc(verifiedUser.address, true);
            await network.provider.send("evm_increaseTime", [KYC_VALIDITY_PERIOD + 1]);
            await network.provider.send("evm_mine");
            await expect(
                daoParty.connect(verifiedUser).createProposal("Test Proposal after KYC expiry", votingPeriod)
            ).to.be.revertedWith("KYC expired");
            // Повторно обновляем KYC через KYCManager
            await kycManager.updateKyc(verifiedUser.address, true);
            await expect(
                daoParty.connect(verifiedUser).createProposal("Test Proposal after KYC renewal", votingPeriod)
            ).to.emit(daoParty, "ProposalCreated");
        });
    });

    describe("Ограничения KYC", function () {
        it("Не должен разрешать использовать один и тот же паспорт (faceId) для верификации другого пользователя", async function () {
            await expect(
                kycManager.verifyUser(otherUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face123")
            ).to.be.revertedWith("Identifier already used");
        });

        it("Не должен разрешать повторную верификацию для одного и того же пользователя без отмены KYC", async function () {
            await expect(
                kycManager.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "faceNew")
            ).to.be.revertedWith("User already verified");
        });

        it("Должен разрешать повторную верификацию с тем же идентификатором после отмены KYC", async function () {
            await kycManager.cancelKyc(verifiedUser.address);
            await expect(
                    kycManager.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face123")
                ).to.emit(kycManager, "KycUpdated")
                .withArgs(verifiedUser.address, true, anyValue, "ВНУТРЕННИЙ ПАСПОРТ РФ");
        });
    });

    describe("Создание предложений и голосование", function () {
        let proposalId;
        beforeEach(async function () {
            // Устанавливаем maxVoters и создаём предложение
            await daoParty.setMaxVoters(100);
            const tx = await daoParty.connect(verifiedUser).createProposal("Proposal 1", votingPeriod);
            const receipt = await tx.wait();

            // Открываем предложение для голосования через likeProposal (ID = 0)
            await daoParty.connect(verifiedUser).likeProposal(0);

            console.log("Transaction logs:", receipt.logs);
            const parsedEvents = receipt.logs
                .map((log) => {
                    try {
                        return daoParty.interface.parseLog(log);
                    } catch (e) {
                        return null;
                    }
                })
                .filter((e) => e && e.name === "ProposalCreated");

            if (parsedEvents.length === 0) {
                throw new Error("ProposalCreated event not found in transaction");
            }
            proposalId = Number(parsedEvents[0].args[0].toString());
        });

        it("Должно создавать предложение с корректным дедлайном", async function () {
            const currentBlock = await ethers.provider.getBlock("latest");
            const proposal = await daoParty.getProposal(proposalId);
            expect(proposal.description).to.equal("Proposal 1");
            expect(proposal.completed).to.equal(false);
            expect(proposal.votesFor).to.equal(0);
            expect(proposal.votesAgainst).to.equal(0);
            expect(proposal.deadline).to.be.closeTo(currentBlock.timestamp + votingPeriod, 5);
        });

        it("Должен позволять голосовать верифицированному пользователю", async function () {
            const tx = await daoParty.connect(verifiedUser).vote(proposalId, true);
            await tx.wait();
            const proposal = await daoParty.getProposal(proposalId);
            expect(proposal.votesFor).to.equal(1);
            expect(await daoParty.hasVoted(proposalId, verifiedUser.address)).to.equal(true);
        });

        it("Не должен позволять двойное голосование", async function () {
            await daoParty.connect(verifiedUser).vote(proposalId, true);
            await expect(
                daoParty.connect(verifiedUser).vote(proposalId, false)
            ).to.be.revertedWith("Already voted");
        });

        it("Не должен позволять голосование после истечения срока", async function () {
            await network.provider.send("evm_increaseTime", [votingPeriod + 1]);
            await network.provider.send("evm_mine");
            await expect(
                daoParty.connect(verifiedUser).vote(proposalId, true)
            ).to.be.revertedWith("Voting period has ended");
        });
    });

    describe("Механизм отмены KYC", function () {
        it("Должен позволять пользователю отменить свой KYC", async function () {
            await expect(kycManager.cancelKyc(verifiedUser.address))
                .to.emit(kycManager, "KycUpdated")
                .withArgs(verifiedUser.address, false, 0, "");

            await expect(kycManager.cancelKyc(verifiedUser.address))
                .to.be.revertedWith("KYC is not active");

            await expect(
                daoParty.connect(verifiedUser).createProposal("Proposal after cancelKyc", votingPeriod)
            ).to.be.revertedWith("KYC verification required");
        });

        it("Должен позволять повторную верификацию после отмены KYC", async function () {
            await kycManager.cancelKyc(verifiedUser.address);

            await expect(
                daoParty.connect(verifiedUser).createProposal("Proposal after cancelKyc", votingPeriod)
            ).to.be.revertedWith("KYC verification required");

            await expect(
                    kycManager.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face123")
                ).to.emit(kycManager, "KycUpdated")
                .withArgs(verifiedUser.address, true, anyValue, "ВНУТРЕННИЙ ПАСПОРТ РФ");

            await expect(
                daoParty.connect(verifiedUser).createProposal("Proposal after re-KYC", votingPeriod)
            ).to.emit(daoParty, "ProposalCreated");
        });
    });

    describe("Автоматическая финализация голосования", function () {
        const maxVoters = 200;
        let proposalId;

        beforeEach(async function () {
            await daoParty.setMaxVoters(maxVoters);
            const tx = await daoParty.connect(verifiedUser).createProposal("Auto Finalization Proposal", votingPeriod);
            const receipt = await tx.wait();
            // Открываем предложение для голосования через likeProposal (ID = 0)
            await daoParty.connect(verifiedUser).likeProposal(0);
            const parsedEvents = receipt.logs
                .map((log) => {
                    try {
                        return daoParty.interface.parseLog(log);
                    } catch (e) {
                        return null;
                    }
                })
                .filter((e) => e && e.name === "ProposalCreated");
            if (parsedEvents.length === 0) {
                throw new Error("ProposalCreated event not found in transaction");
            }
            proposalId = Number(parsedEvents[0].args[0].toString());
        });

        it("Должна автоматически завершаться голосование, если исход предрешён (пример 1)", async function () {
            // Устанавливаем maxVoters = 100
            await daoParty.setMaxVoters(100);
            const additionalVoters = [];
            const totalVotersNeeded = 52;
            for (let i = 0; i < totalVotersNeeded; i++) {
                const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
                await owner.sendTransaction({
                    to: wallet.address,
                    value: ethers.parseEther("1")
                });
                await nftPassport.mintPassport(wallet.address);
                await kycManager.updateKyc(wallet.address, true);
                await daoParty.connect(wallet).likeProposal(proposalId);
                additionalVoters.push(wallet);
            }
            for (let i = 0; i < totalVotersNeeded; i++) {
                try {
                    await daoParty.connect(additionalVoters[i]).vote(proposalId, true);
                } catch (e) {
                    expect(e.message).to.include("Proposal already finalized");
                    break;
                }
            }
            const proposal = await daoParty.getProposal(proposalId);
            expect(proposal.completed).to.equal(true);

            await expect(
                daoParty.connect(additionalVoters[0]).vote(proposalId, true)
            ).to.be.revertedWith("Proposal already finalized");
        });

        it("Голосование продолжается, если исход ещё может измениться (пример 2)", async function () {
            await daoParty.setMaxVoters(300);
            const additionalVoters = [];
            for (let i = 0; i < 270; i++) {
                const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
                await owner.sendTransaction({
                    to: wallet.address,
                    value: ethers.parseEther("1")
                });
                await nftPassport.mintPassport(wallet.address);
                await kycManager.updateKyc(wallet.address, true);
                await daoParty.connect(wallet).likeProposal(proposalId);
                additionalVoters.push(wallet);
            }
            for (let i = 0; i < 140; i++) {
                await daoParty.connect(additionalVoters[i]).vote(proposalId, true);
            }
            for (let i = 140; i < 270; i++) {
                await daoParty.connect(additionalVoters[i]).vote(proposalId, false);
            }
            const proposal = await daoParty.getProposal(proposalId);
            expect(proposal.completed).to.equal(false);
        });
    });

    describe("Финализация предложений", function () {
        let proposalId;
        beforeEach(async function () {
            const tx = await daoParty.connect(verifiedUser).createProposal("Proposal Finalize", votingPeriod);
            const receipt = await tx.wait();

            console.log("Transaction logs:", receipt.logs);

            if (!receipt.logs || receipt.logs.length === 0) {
                throw new Error("ProposalCreated event not emitted");
            }

            const event = receipt.logs.find(e => e.fragment && e.fragment.name === "ProposalCreated");
            if (!event) {
                throw new Error("ProposalCreated event not found in transaction");
            }

            proposalId = Number(event.args[0]);
        });

        it("Не должен позволять финализировать предложение до истечения срока", async function () {
            await expect(daoParty.finalizeProposal(proposalId))
                .to.be.revertedWith("Voting period is not over yet");
        });

        it("Должен позволять владельцу финализировать предложение после истечения срока", async function () {
            await network.provider.send("evm_increaseTime", [votingPeriod + 1]);
            await network.provider.send("evm_mine");
            const tx = await daoParty.finalizeProposal(proposalId);
            await tx.wait();
            const proposal = await daoParty.getProposal(proposalId);
            expect(proposal.completed).to.equal(true);
        });

        it("Не должен позволять не-владельцу финализировать предложение", async function () {
            await network.provider.send("evm_increaseTime", [votingPeriod + 1]);
            await network.provider.send("evm_mine");
            await expect(
                daoParty.connect(verifiedUser).finalizeProposal(proposalId)
            ).to.be.reverted;
        });
    });

    describe("Ограничение частоты создания предложений", function () {
        it("Не должен позволять одному пользователю создавать больше одного предложения в 30 дней", async function () {
            // Первый вызов должен успешно создать предложение
            await expect(
                daoParty.connect(verifiedUser).createProposal("Proposal A", votingPeriod)
            ).to.emit(daoParty, "ProposalCreated");

            // Второй вызов от того же пользователя сразу должен быть отклонён
            await expect(
                daoParty.connect(verifiedUser).createProposal("Proposal B", votingPeriod)
            ).to.be.revertedWith("You can only create one proposal every 30 days");
        });

        it("Должен позволять создавать новое предложение после истечения 30 дней", async function () {
            // Создаём первое предложение
            await expect(
                daoParty.connect(verifiedUser).createProposal("Proposal A", votingPeriod)
            ).to.emit(daoParty, "ProposalCreated");

            // Увеличиваем время на 30 дней (2592000 секунд) + 1 секунда
            await network.provider.send("evm_increaseTime", [2592000 + 1]);
            await network.provider.send("evm_mine");

            // Обновляем KYC для verifiedUser через KYCManager
            await kycManager.updateKyc(verifiedUser.address, true);

            // Повторный вызов должен сработать, так как прошло достаточно времени и KYC актуально
            await expect(
                daoParty.connect(verifiedUser).createProposal("Proposal B", votingPeriod)
            ).to.emit(daoParty, "ProposalCreated");
        });
    });

    // Новый функционал: Механизм голосования за изменение состава администраторов
    describe("Механизм голосования за изменение состава администраторов", function () {
        let adminProposalId;
        beforeEach(async function () {
            const tx = await daoParty
                .connect(verifiedUser)
                .proposeAdminChange(otherUser.address, true, "Добавить otherUser в администраторы", votingPeriod);
            const receipt = await tx.wait();
            const parsedEvents = receipt.logs
                .map(log => {
                    try {
                        return daoParty.interface.parseLog(log);
                    } catch (e) {
                        return null;
                    }
                })
                .filter(e => e && e.name === "AdminProposalCreated");
            if (parsedEvents.length === 0) {
                throw new Error("AdminProposalCreated event not found");
            }
            adminProposalId = parsedEvents[0].args.proposalId;
        });

        it("Должен позволять создавать предложение по изменению состава администраторов", async function () {
            expect(adminProposalId).to.be.a("bigint");
        });

        it("Должен позволять голосовать за предложение по изменению состава администраторов и автоматически финализировать его", async function () {
            await daoParty.setMaxVoters(100);
            const additionalVoters = [];
            const totalVotersNeeded = 51;
            for (let i = 0; i < totalVotersNeeded; i++) {
                const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
                await owner.sendTransaction({
                    to: wallet.address,
                    value: ethers.parseEther("1")
                });
                await nftPassport.mintPassport(wallet.address);
                await kycManager.updateKyc(wallet.address, true);
                additionalVoters.push(wallet);
            }
            for (let i = 0; i < totalVotersNeeded; i++) {
                await daoParty.connect(additionalVoters[i]).voteAdminProposal(adminProposalId, true);
            }
            expect(await daoParty.admins(otherUser.address)).to.equal(true);
        });

        it("Должен позволять владельцу финализировать админ предложение после истечения срока", async function () {
            // Устанавливаем maxVoters так, чтобы автофинализация не сработала
            await daoParty.setMaxVoters(1000);
            // Создаём новое предложение
            const tx = await daoParty
                .connect(verifiedUser)
                .proposeAdminChange(otherUser.address, true, "Добавить otherUser в администраторы", votingPeriod);
            const receipt = await tx.wait();
            const parsedEvents = receipt.logs
                .map(log => {
                    try {
                        return daoParty.interface.parseLog(log);
                    } catch (e) {
                        return null;
                    }
                })
                .filter(e => e && e.name === "AdminProposalCreated");
            if (parsedEvents.length === 0) {
                throw new Error("AdminProposalCreated event not found");
            }
            const adminProposalIdManual = parsedEvents[0].args.proposalId;
            // Голосуем от verifiedUser и еще одного кошелька, чтобы итог был "approved"
            await daoParty.connect(verifiedUser).voteAdminProposal(adminProposalIdManual, true);
            const extraWallet = ethers.Wallet.createRandom().connect(ethers.provider);
            await owner.sendTransaction({
                to: extraWallet.address,
                value: ethers.parseEther("1")
            });
            await nftPassport.mintPassport(extraWallet.address);
            await kycManager.updateKyc(extraWallet.address, true);
            await daoParty.connect(extraWallet).voteAdminProposal(adminProposalIdManual, true);
            // Ждем истечения срока
            await network.provider.send("evm_increaseTime", [votingPeriod + 1]);
            await network.provider.send("evm_mine");
            await expect(daoParty.finalizeAdminProposal(adminProposalIdManual))
                .to.emit(daoParty, "AdminProposalFinalized")
                .withArgs(adminProposalIdManual, true);
            expect(await daoParty.admins(otherUser.address)).to.equal(true);
        });
    });
});
