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
    let daoParty, nftPassport;
    let owner, verifiedUser, unverifiedUser, otherUser;
    const votingPeriod = 3600; // 1 час
    const KYC_VALIDITY_PERIOD = 2592000; // 30 дней в секундах

    beforeEach(async function () {
    [owner, verifiedUser, unverifiedUser, otherUser] = await ethers.getSigners();

        // Развёртывание NFTPassport (контракт для ментинга NFT)
        const NFTPassport = await ethers.getContractFactory("NFTPassport");
        nftPassport = await NFTPassport.deploy();
        await nftPassport.waitForDeployment();

        const nftPassportAddress = await nftPassport.getAddress();
        console.log("NFTPassport deployed at:", nftPassportAddress);

        // Выдаем NFT для verifiedUser (при необходимости другим)
        await nftPassport.mintPassport(verifiedUser.address);

        // Развёртывание DaoParty
        const DaoParty = await ethers.getContractFactory("DaoParty");
        daoParty = await DaoParty.deploy(owner.address);
        await daoParty.waitForDeployment();

        await daoParty.setNftContract(nftPassportAddress);

        // Верифицируем пользователя через verifyUser с корректными данными:
        // documentType: "ВНУТРЕННИЙ ПАСПОРТ РФ", liveness: true, faceId: "face123"
        await daoParty.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face123");
    });

    describe("Функции администратора", function () {
        it("Должен позволять владельцу установить адрес NFT-контракта и выбросить событие", async function () {
            await expect(daoParty.setNftContract(await nftPassport.getAddress()))
                .to.emit(daoParty, "NftContractUpdated")
                .withArgs(await nftPassport.getAddress());
        });

        it("Должен позволять владельцу обновить статус KYC и выбросить событие", async function () {
            // При вызове updateKyc без документа тип возвращается как пустая строка ""
            await expect(daoParty.updateKyc(unverifiedUser.address, true))
                .to.emit(daoParty, "KycUpdated")
                .withArgs(unverifiedUser.address, true, anyValue, "");
        });

        it("Должен позволять верифицировать пользователя с корректным документом, liveness и FaceID", async function () {
            await expect(daoParty.verifyUser(otherUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face456"))
                .to.emit(daoParty, "KycUpdated")
                .withArgs(otherUser.address, true, anyValue, "ВНУТРЕННИЙ ПАСПОРТ РФ");
        });

        it("Должен отклонять верификацию пользователя с некорректным документом", async function () {
            await expect(
                daoParty.verifyUser(otherUser.address, "Заграничный паспорт", true, "face456")
            ).to.be.revertedWith("Only Russian internal passports are allowed");
        });

        it("Должен отклонять верификацию, если liveness check не пройдена", async function () {
            await expect(
                daoParty.verifyUser(otherUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", false, "face456")
            ).to.be.revertedWith("Liveness check failed");
        });

        it("Должен отклонять верификацию, если faceID пустой", async function () {
            await expect(
                daoParty.verifyUser(otherUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "")
            ).to.be.revertedWith("Invalid faceID");
        });
    });

    describe("Проверка требований KYC и NFT", function () {
        it("Должен отклонять создание предложения, если NFT-контракт не установлен", async function () {
            const DaoParty = await ethers.getContractFactory("DaoParty");
            const daoPartyNoNFT = await DaoParty.deploy(owner.address);
            await daoPartyNoNFT.waitForDeployment();
            // Верифицируем пользователя, чтобы KYC не было причиной ошибки
            await daoPartyNoNFT.updateKyc(verifiedUser.address, true);
            await expect(
                daoPartyNoNFT.connect(verifiedUser).createProposal("Test Proposal", votingPeriod)
            ).to.be.revertedWith("NFT contract not set");
        });

        it("Должен отклонять создание предложения, если вызывающий не владеет NFT", async function () {
            await daoParty.updateKyc(unverifiedUser.address, true);
            await expect(
                daoParty.connect(unverifiedUser).createProposal("Test Proposal", votingPeriod)
            ).to.be.revertedWith("You must own an NFT");
        });

        it("Должен отклонять создание предложения, если KYC не пройден", async function () {
            // Выдаем NFT otherUser, но не верифицируем его
            await nftPassport.mintPassport(otherUser.address);
            await expect(
                daoParty.connect(otherUser).createProposal("Test Proposal", votingPeriod)
            ).to.be.revertedWith("KYC verification required");
        });
    });

    describe("Механизм повторного KYC", function () {
        it("Должен блокировать создание предложения, если срок KYC истёк", async function () {
            // Обновляем KYC для verifiedUser, чтобы установить срок
            await daoParty.updateKyc(verifiedUser.address, true);
            // Увеличиваем время на больше чем KYC_VALIDITY_PERIOD (например, 30 дней + 1 секунда)
            await network.provider.send("evm_increaseTime", [KYC_VALIDITY_PERIOD + 1]);
            await network.provider.send("evm_mine");
            await expect(
                daoParty.connect(verifiedUser).createProposal("Test Proposal after KYC expiry", votingPeriod)
            ).to.be.revertedWith("KYC expired");
        });

        it("Должен разрешать создание предложения после повторного KYC", async function () {
            // Обновляем KYC для verifiedUser
            await daoParty.updateKyc(verifiedUser.address, true);
            // Симулируем истечение срока KYC
            await network.provider.send("evm_increaseTime", [KYC_VALIDITY_PERIOD + 1]);
            await network.provider.send("evm_mine");
            // Попытка создания предложения должна отклоняться
            await expect(
                daoParty.connect(verifiedUser).createProposal("Test Proposal after KYC expiry", votingPeriod)
            ).to.be.revertedWith("KYC expired");
            // Выполняем повторное обновление KYC (периодически подтверждаем личность)
            await daoParty.updateKyc(verifiedUser.address, true);
            // Теперь создание предложения должно проходить успешно
            await expect(
                daoParty.connect(verifiedUser).createProposal("Test Proposal after KYC renewal", votingPeriod)
            ).to.emit(daoParty, "ProposalCreated");
        });
    });

    describe("Создание предложений и голосование", function () {
        let proposalId;
        beforeEach(async function () {
            const tx = await daoParty.connect(verifiedUser).createProposal("Proposal 1", votingPeriod);
            const receipt = await tx.wait();

            console.log("Transaction logs:", receipt.logs);

            if (!receipt.logs || receipt.logs.length === 0) {
                throw new Error("ProposalCreated event not emitted");
            }

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
            // verifiedUser уже верифицирован на этапе beforeEach
            // Вызываем cancelKyc и проверяем выброс события KycUpdated с корректными параметрами.
            await expect(daoParty.connect(verifiedUser).cancelKyc())
                .to.emit(daoParty, "KycUpdated")
                .withArgs(verifiedUser.address, false, 0, "");

            // При повторном вызове cancelKyc() должно выбрасываться revert,
            // так как KYC уже не активен
            await expect(daoParty.connect(verifiedUser).cancelKyc())
                .to.be.revertedWith("KYC is not active");

            // После отмены KYC попытка создать предложение должна быть отклонена.
            await expect(
                daoParty.connect(verifiedUser).createProposal("Proposal after cancelKyc", votingPeriod)
            ).to.be.revertedWith("KYC verification required");
        });

        it("Должен позволять повторную верификацию после отмены KYC", async function () {
            // Сначала отменяем KYC для verifiedUser.
            await daoParty.connect(verifiedUser).cancelKyc();

            // Создание предложения должно отклоняться, так как KYC не пройден.
            await expect(
                daoParty.connect(verifiedUser).createProposal("Proposal after cancelKyc", votingPeriod)
            ).to.be.revertedWith("KYC verification required");

            // Теперь владелец повторно верифицирует пользователя.
            await expect(
                    daoParty.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face123")
                ).to.emit(daoParty, "KycUpdated")
                .withArgs(verifiedUser.address, true, anyValue, "ВНУТРЕННИЙ ПАСПОРТ РФ");

            // После повторной верификации создание предложения должно проходить успешно.
            await expect(
                daoParty.connect(verifiedUser).createProposal("Proposal after re-KYC", votingPeriod)
            ).to.emit(daoParty, "ProposalCreated");
        });
    });


    describe("Механизм отмены KYC", function () {
        it("Должен позволять пользователю отменить свой KYC", async function () {
            // verifiedUser уже верифицирован
            // Вызываем cancelKyc и проверяем выброс событий
            await expect(daoParty.connect(verifiedUser).cancelKyc())
                .to.emit(daoParty, "KycUpdated")
                .withArgs(verifiedUser.address, false, 0, "");
            await expect(daoParty.connect(verifiedUser).cancelKyc())
                .to.be.revertedWith("KYC is not active");

            // После отмены KYC попытка создать предложение должна быть отклонена
            await expect(
                daoParty.connect(verifiedUser).createProposal("Proposal after cancelKyc", votingPeriod)
            ).to.be.revertedWith("KYC verification required");
        });

        it("Должен позволять повторную верификацию после отмены KYC", async function () {
            // Отменяем KYC для verifiedUser
            await daoParty.connect(verifiedUser).cancelKyc();

            // Теперь попытка создания предложения должна отклоняться, так как KYC не пройден
            await expect(
                daoParty.connect(verifiedUser).createProposal("Proposal after cancelKyc", votingPeriod)
            ).to.be.revertedWith("KYC verification required");

            // Владелец повторно верифицирует пользователя
            await expect(
                    daoParty.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face123")
                ).to.emit(daoParty, "KycUpdated")
                .withArgs(verifiedUser.address, true, anyValue, "ВНУТРЕННИЙ ПАСПОРТ РФ");

            // После повторной верификации создание предложения должно проходить успешно
            await expect(
                daoParty.connect(verifiedUser).createProposal("Proposal after re-KYC", votingPeriod)
            ).to.emit(daoParty, "ProposalCreated");
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
});
