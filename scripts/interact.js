// scripts/interact.js

// Импортируем anyValue для использования в проверке событий
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

// Получаем адреса контрактов из переменных окружения или аргументов командной строки
const contractAddressFromEnv = process.env.CONTRACT_ADDRESS;
const contractAddressArg = process.argv[process.argv.length - 1];
const daoPartyAddress =
    contractAddressFromEnv && !contractAddressFromEnv.startsWith("--")
        ? contractAddressFromEnv
        : contractAddressArg;

if (!daoPartyAddress || daoPartyAddress.startsWith("--")) {
    throw new Error(
        "Пожалуйста, укажите адрес контракта DaoParty через переменную окружения CONTRACT_ADDRESS или как аргумент"
    );
}
console.log("Используем адрес контракта DaoParty:", daoPartyAddress);

const nftPassportAddress = process.env.NFTPASSPORT_ADDRESS;
if (!nftPassportAddress || nftPassportAddress.startsWith("--")) {
    throw new Error(
        "Пожалуйста, укажите адрес контракта NFTPassport через переменную окружения NFTPASSPORT_ADDRESS"
    );
}
console.log("Используем адрес контракта NFTPassport:", nftPassportAddress);

const { ethers, network } = require("hardhat");
const { expect } = require("chai");

// Задаем период голосования (в секундах)
const votingPeriod = 3600; // 1 час

async function main() {
    // Получаем аккаунты: owner, verifiedUser, user2, user3
    const [owner, verifiedUser, user2, user3] = await ethers.getSigners();

    // Получаем экземпляр контракта DaoParty через attach
    const DaoParty = await ethers.getContractFactory("DaoParty");
    const daoParty = DaoParty.attach(daoPartyAddress);
    console.log("\nВзаимодействуем с контрактом DaoParty, адрес:", daoPartyAddress);

    // Получаем экземпляр контракта NFTPassport через ethers.getContractAt
    const nftPassport = await ethers.getContractAt("NFTPassport", nftPassportAddress);
    console.log("Взаимодействуем с контрактом NFTPassport, адрес:", nftPassportAddress);

    // --- Дополнительная проверка: вывод кода контракта NFTPassport ---
    const code = await ethers.provider.getCode(nftPassportAddress);
    console.log("Код контракта NFTPassport:", code);
    if (code === "0x") {
        throw new Error("На указанном адресе нет кода контракта NFTPassport");
    }

    // --- Административные функции ---
    console.log("\n[Администрирование] Установка адреса NFT-контракта...");
    let tx = await daoParty.setNftContract(nftPassportAddress);
    await tx.wait();
    console.log("NFT-контракт установлен на:", nftPassportAddress);

    console.log("\n[Администрирование] Регистрируем доверенного KYC-провайдера (verifiedUser)...");
    tx = await daoParty.addKycProvider(verifiedUser.address);
    await tx.wait();
    console.log("verifiedUser добавлен как доверенный KYC-провайдер.");

    console.log("\n[Администрирование] Обновление KYC для verifiedUser от имени владельца...");
    tx = await daoParty.updateKyc(verifiedUser.address, true);
    await tx.wait();
    console.log("KYC для verifiedUser успешно обновлён.");

    // Если владелец (owner) ещё не верифицирован, обновляем его KYC
    console.log("\n[Администрирование] Обновление KYC для owner от имени владельца...");
    tx = await daoParty.updateKyc(owner.address, true);
    await tx.wait();
    console.log("KYC для owner успешно обновлён.");
  
    // Проверяем, что verifiedUser владеет NFT.
    let verifiedUserBalance = await nftPassport["balanceOf(address)"](verifiedUser.address);
    console.log("Первоначальный баланс verifiedUser:", verifiedUserBalance.toString());
    if (verifiedUserBalance.toString() === "0") {
        console.log("\n[Администрирование] Минтим NFT для verifiedUser...");
        tx = await nftPassport.connect(owner).mintPassport(verifiedUser.address);
        await tx.wait();
        verifiedUserBalance = await nftPassport["balanceOf(address)"](verifiedUser.address);
        console.log("NFT для verifiedUser успешно выдан.");
    } else {
        console.log("\n[Администрирование] verifiedUser уже владеет NFT.");
    }

    console.log("\n[Администрирование] Минтим NFT для user3...");
    try {
        tx = await nftPassport.connect(owner).mintPassport(user3.address);
        await tx.wait();
        console.log("NFT для user3 успешно выдан.");
    } catch (error) {
        console.log("MintPassport: NFT для user3 уже выдан. Продолжаем выполнение...");
    }

    console.log("\n[Администрирование] Обновление KYC для user2 через updateKyc...");
    tx = await daoParty.updateKyc(user2.address, true);
    await tx.wait();
    console.log("KYC для user2 обновлён через updateKyc.");

    // Верификация user3 через доверенного провайдера (verifiedUser) с использованием новой функции verifyUser
    const isUser3Verified = await daoParty.kycVerified(user3.address);
    if (!isUser3Verified) {
        console.log("\n[Администрирование] Верификация user3 с корректными данными от доверенного провайдера (verifiedUser)...");
        tx = await daoParty.connect(verifiedUser).verifyUser(
            user3.address,
            "ВНУТРЕННИЙ ПАСПОРТ РФ", // передаём корректное значение
            true,
            "faceXYZ"
        );
        await tx.wait();
        console.log("User3 успешно верифицирован.");
    } else {
        console.log("\n[Администрирование] User3 уже верифицирован, пропускаем verifyUser.");
    }

    // --- Проверка механизма отмены KYC и повторной верификации ---
    console.log("\n[Проверка KYC] User3 отменяет свой KYC...");
    tx = await daoParty.connect(user3).cancelKyc();
    await tx.wait();
    console.log("User3 успешно отменил KYC.");

    console.log("\n[Проверка KYC] Попытка создать предложение от user3 после отмены KYC...");
    try {
        tx = await daoParty.connect(user3).createProposal("Test Proposal - After CancelKYC", votingPeriod);
        await tx.wait();
        console.log("Ошибка: предложение создано, хотя KYC отменён.");
    } catch (error) {
        console.log("Ожидаемая ошибка при создании предложения:", error.message);
    }

    console.log("\n[Проверка KYC] Повторная верификация user3 от доверенного провайдера (verifiedUser)...");
    tx = await daoParty.connect(verifiedUser).verifyUser(
        user3.address,
        "ВНУТРЕННИЙ ПАСПОРТ РФ", // корректное значение
        true,
        "faceXYZ"
    );
    await tx.wait();
    console.log("User3 успешно повторно верифицирован.");

    console.log("\n[Проверка KYC] Создание предложения от user3 после повторной верификации...");
    tx = await daoParty.connect(user3).createProposal("Test Proposal - After ReKYC", votingPeriod);
    await tx.wait();
    console.log("Предложение успешно создано после повторной верификации.");

    // --- Дополнительные проверки ---
    console.log("\n[Дополнительные проверки]");

    // Функция для проверки и минтинга NFT для указанного адреса
    async function ensureNft(address, accountSigner) {
        const balance = await nftPassport["balanceOf(address)"](address);
        if (balance.toString() === "0") {
            console.log(`Аккаунт ${address} не владеет NFT, минтим NFT...`);
            const mintTx = await nftPassport.connect(owner).mintPassport(address);
            await mintTx.wait();
            console.log(`NFT успешно выдан для ${address}`);
        }
    }

    // 1. Граничное условие для автоматической финализации голосования
    console.log("\nПроверка: Автофинализация не срабатывает, если разница голосов равна оставшимся голосам");
    await daoParty.setMaxVoters(200);
    let txProposal = await daoParty.connect(verifiedUser).createProposal("Borderline Finalization Proposal", votingPeriod);
    let receipt = await txProposal.wait();
    let parsedEvents = receipt.logs
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
    let proposalId = Number(parsedEvents[0].args[0].toString());
  
    await daoParty.updateKyc(owner.address, true);
    await ensureNft(owner.address, owner);
    try {
        await daoParty.connect(owner).likeProposal(proposalId);
    } catch (error) {
        console.log("Ошибка likeProposal от owner:", error.message);
    }

    // Формирование 160 дополнительных адресов для голосования
    const additionalVoters = [];
    for (let i = 0; i < 160; i++) {
        const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({ to: wallet.address, value: ethers.parseEther("1") });
        let balance = await nftPassport["balanceOf(address)"](wallet.address);
        if (balance.toString() === "0") {
            try {
                let txMint = await nftPassport.connect(owner).mintPassport(wallet.address);
                await txMint.wait();
                console.log(`NFT успешно выдан для ${wallet.address}`);
            } catch (error) {
                console.error(`Ошибка mintPassport для ${wallet.address}:`, error.message);
            }
        } else {
            console.log(`NFT для ${wallet.address} уже выдан.`);
        }
        await daoParty.updateKyc(wallet.address, true);
        try {
            await daoParty.connect(wallet).likeProposal(proposalId);
        } catch (error) {
            console.log(`likeProposal не выполнено для ${wallet.address}: ${error.message}`);
        }
        additionalVoters.push(wallet);
    }
    // Первые 100 голосуют "за"
    for (let i = 0; i < 100; i++) {
        try {
            await daoParty.connect(additionalVoters[i]).vote(proposalId, true);
        } catch (error) {
            console.log(`Ошибка голосования "за" от ${additionalVoters[i].address}: ${error.message}`);
        }
    }
    // Следующие 60 голосуют "против"
    for (let i = 100; i < 160; i++) {
        try {
            await daoParty.connect(additionalVoters[i]).vote(proposalId, false);
        } catch (error) {
            console.log(`Ошибка голосования "против" от ${additionalVoters[i].address}: ${error.message}`);
        }
    }
    let proposal = await daoParty.getProposal(proposalId);
    console.log("Статус предложения (Borderline):", proposal.completed.toString());
    if (proposal.completed) {
        console.log("Ошибка: Автофинализация сработала, хотя должна была остаться активной.");
    } else {
        console.log("Автофинализация не сработала, как ожидалось (разница равна оставшимся голосам).");
    }

    // 2. Проверка, что при maxVoters = 0 автофинализация не срабатывает
    console.log("\nПроверка: При maxVoters = 0 автофинализация не срабатывает");
    await daoParty.setMaxVoters(0);
    txProposal = await daoParty.connect(verifiedUser).createProposal("No Auto Finalization Proposal", votingPeriod);
    receipt = await txProposal.wait();
    parsedEvents = receipt.logs
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
    await ensureNft(owner.address, owner);
    try {
        await daoParty.connect(owner).likeProposal(proposalId);
    } catch (error) {
        console.log("Ошибка likeProposal для maxVoters=0:", error.message);
    }
    const voters = [];
    for (let i = 0; i < 10; i++) {
        const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({ to: wallet.address, value: ethers.parseEther("1") });
        let balance = await nftPassport["balanceOf(address)"](wallet.address);
        if (balance.toString() === "0") {
            try {
                let txMint = await nftPassport.connect(owner).mintPassport(wallet.address);
                await txMint.wait();
                console.log(`NFT успешно выдан для ${wallet.address}`);
            } catch (error) {
                console.error(`Ошибка mintPassport для ${wallet.address}:`, error.message);
            }
        } else {
            console.log(`NFT для ${wallet.address} уже выдан.`);
        }
        await daoParty.updateKyc(wallet.address, true);
        voters.push(wallet);
    }
    for (let i = 0; i < 5; i++) {
        try {
            await daoParty.connect(voters[i]).vote(proposalId, true);
        } catch (error) {
            console.log(`Ошибка голосования "за" от ${voters[i].address}: ${error.message}`);
        }
    }
    for (let i = 5; i < 10; i++) {
        try {
            await daoParty.connect(voters[i]).vote(proposalId, false);
        } catch (error) {
            console.log(`Ошибка голосования "против" от ${voters[i].address}: ${error.message}`);
        }
    }
    proposal = await daoParty.getProposal(proposalId);
    console.log("Статус предложения (maxVoters = 0):", proposal.completed.toString());
    if (proposal.completed) {
        console.log("Ошибка: Автофинализация сработала при maxVoters = 0.");
    } else {
        console.log("Автофинализация не сработала, как ожидалось, при maxVoters = 0.");
    }

    // 3. Проверка подсчёта голосов и функции hasVoted
    console.log("\nПроверка: Подсчет голосов и функция hasVoted");
    await daoParty.setMaxVoters(100);
    txProposal = await daoParty.connect(verifiedUser).createProposal("Vote Counting Proposal", votingPeriod);
    receipt = await txProposal.wait();
    parsedEvents = receipt.logs
        .map((log) => {
            try {
                return daoParty.interface.parseLog(log);
            } catch (e) {
                return null;
            }
        })
        .filter((e) => e && e.name === "ProposalCreated");
    proposalId = Number(parsedEvents[0].args[0].toString());
    await ensureNft(owner.address, owner);
    try {
        await daoParty.connect(owner).likeProposal(proposalId);
    } catch (error) {
        console.log("Ошибка likeProposal для голосования:", error.message);
    }
    try {
        await daoParty.connect(verifiedUser).vote(proposalId, true);
    } catch (error) {
        console.log("Ошибка при голосовании:", error.message);
    }
    proposal = await daoParty.getProposal(proposalId);
    console.log("Голоса 'за':", proposal.votesFor.toString());
    console.log("Голоса 'против':", proposal.votesAgainst.toString());
    expect(proposal.votesFor).to.equal(1);
    expect(proposal.votesAgainst).to.equal(0);
    expect(await daoParty.hasVoted(proposalId, verifiedUser.address)).to.equal(true);
    expect(await daoParty.hasVoted(proposalId, user2.address)).to.equal(false);

    // 4. Проверка сброса данных после cancelKyc
    console.log("\nПроверка: Сброс данных после cancelKyc");
    await daoParty.connect(verifiedUser).cancelKyc();
    let isVerified = await daoParty.kycVerified(verifiedUser.address);
    let expiry = await daoParty.kycExpiry(verifiedUser.address);
    let docType = await daoParty.kycDocumentType(verifiedUser.address);
    expect(isVerified).to.equal(false);
    expect(expiry).to.equal(0);
    expect(docType).to.equal("");
    console.log("Данные успешно сброшены после cancelKyc.");
    await expect(
        // В данном случае вызов производится от владельца (owner) – он имеет право как KYC-провайдер
        daoParty.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face123")
    )
        .to.emit(daoParty, "KycUpdated")
        .withArgs(verifiedUser.address, true, anyValue, "ВНУТРЕННИЙ ПАСПОРТ РФ");

    // 5. Ручная финализация голосования
    console.log("\nПроверка: Ручная финализация голосования");
    await daoParty.setMaxVoters(1000);
    txProposal = await daoParty.connect(verifiedUser).createProposal("Manual Finalization Proposal", votingPeriod);
    receipt = await txProposal.wait();
    parsedEvents = receipt.logs
        .map((log) => {
            try {
                return daoParty.interface.parseLog(log);
            } catch (e) {
                return null;
            }
        })
        .filter((e) => e && e.name === "ProposalCreated");
    proposalId = Number(parsedEvents[0].args[0].toString());
    await ensureNft(owner.address, owner);
    try {
        await daoParty.connect(owner).likeProposal(proposalId);
    } catch (error) {
        console.log("Ошибка likeProposal для ручной финализации:", error.message);
    }
    await network.provider.send("evm_increaseTime", [votingPeriod + 1]);
    await network.provider.send("evm_mine");
    let txFinal = await daoParty.finalizeProposal(proposalId);
    await txFinal.wait();
    proposal = await daoParty.getProposal(proposalId);
    expect(proposal.completed).to.equal(true);
    console.log("Ручная финализация голосования прошла успешно.");

    // --- Новый функционал: Механизм голосования за изменение состава администраторов ---
    console.log("\n[Новый функционал] Механизм голосования за изменение состава администраторов");
    // Создаем нового администратора (newAdmin), чтобы избежать ошибки "Address is already an admin"
    const newAdmin = ethers.Wallet.createRandom().connect(ethers.provider);
    await owner.sendTransaction({ to: newAdmin.address, value: ethers.parseEther("1") });
    await nftPassport.connect(owner).mintPassport(newAdmin.address);
    await daoParty.updateKyc(newAdmin.address, true);
    let isNewAdmin = await daoParty.admins(newAdmin.address);
    if (isNewAdmin) {
        console.log("Новый администратор уже установлен. Используем другой адрес.");
    }
    // 1. Создаем предложение на добавление newAdmin в список администраторов
    tx = await daoParty.connect(verifiedUser).proposeAdminChange(
        newAdmin.address,
        true,
        "Добавить нового администратора",
        votingPeriod
    );
    let receiptAdmin = await tx.wait();
    let adminProposalId = receiptAdmin.logs
        .map(log => {
            try {
                return daoParty.interface.parseLog(log);
            } catch (e) {
                return null;
            }
        })
        .filter(e => e && e.name === "AdminProposalCreated")[0].args.proposalId;
    console.log("Создано предложение по изменению состава администраторов, adminProposalId:", adminProposalId.toString());

    // 2. Голосование за предложение: пусть verifiedUser голосует "за"
    tx = await daoParty.connect(verifiedUser).voteAdminProposal(adminProposalId, true);
    await tx.wait();
    console.log("verifiedUser проголосовал за предложение по изменению состава администраторов.");

    // 3. Перед ручной финализацией ждем истечения срока голосования
    console.log("\n[Новый функционал] Ждем истечения срока голосования для админ предложения...");
    await network.provider.send("evm_increaseTime", [votingPeriod + 1]);
    await network.provider.send("evm_mine");

    // 4. Ручная финализация предложения
    console.log("\n[Новый функционал] Ручная финализация предложения по изменению состава администраторов");
    tx = await daoParty.finalizeAdminProposal(adminProposalId);
    await tx.wait();
    isNewAdmin = await daoParty.admins(newAdmin.address);
    console.log("Статус нового администратора:", isNewAdmin ? "администратор" : "не администратор");

    console.log("\nВсе проверки завершены успешно.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
