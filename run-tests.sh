#!/bin/bash

echo "Запуск теста 1: nftPassport.deployment.test.js"
npx hardhat test ./test/nftPassport.deployment.test.js || exit 1

echo "Запуск теста 2: daoParty.deployment.test.js"
npx hardhat test ./test/daoParty.deployment.test.js || exit 1

echo "Запуск теста 3: daoParty.Fixture.test.js"
npx hardhat test ./test/daoParty.Fixture.test.js || exit 1

echo "Запуск теста 4: daoParty.admin.test.js"
npx hardhat test ./test/daoParty.admin.test.js || exit 1

echo "Запуск теста 5: daoParty.kyc.test.js"
npx hardhat test ./test/daoParty.kyc.test.js || exit 1

echo "Запуск теста 6: daoParty.proposal.test.js"
npx hardhat test ./test/daoParty.proposal.test.js || exit 1

echo "Запуск теста 7: daoParty.adminProposal.test.js"
npx hardhat test ./test/daoParty.adminProposal.test.js || exit 1
