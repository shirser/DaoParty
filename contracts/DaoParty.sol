// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DaoParty is Ownable {
    struct Proposal {
        string description;
        bool completed;
        uint256 votesFor;
        uint256 votesAgainst;
        mapping(address => bool) voted;
    }

    Proposal[] public proposals;

    event ProposalCreated(uint256 proposalId, string description);
    event Voted(uint256 proposalId, address voter, bool support);
    event ProposalFinalized(uint256 proposalId);

    // Передаём аргумент initialOwner базовому конструктору Ownable.
    constructor(address initialOwner) Ownable(initialOwner) {
        // Дополнительной логики в конструкторе не требуется,
        // так как базовый конструктор уже установит владельца.
    }

    function createProposal(string memory description) external onlyOwner {
        proposals.push();
        uint256 proposalId = proposals.length - 1;
        Proposal storage newProposal = proposals[proposalId];
        newProposal.description = description;
        newProposal.completed = false;
        newProposal.votesFor = 0;
        newProposal.votesAgainst = 0;
        emit ProposalCreated(proposalId, description);
    }

    function vote(uint256 proposalId, bool support) external {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        require(!p.completed, "Proposal already finalized");
        require(!p.voted[msg.sender], "Already voted");

        p.voted[msg.sender] = true;
        if (support) {
            p.votesFor++;
        } else {
            p.votesAgainst++;
        }
        emit Voted(proposalId, msg.sender, support);
    }

    function finalizeProposal(uint256 proposalId) external onlyOwner {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        require(!p.completed, "Proposal already finalized");

        p.completed = true;
        emit ProposalFinalized(proposalId);
    }
}
