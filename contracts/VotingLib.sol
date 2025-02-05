// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library VotingLib {
    /// @notice Проверяет, можно ли досрочно завершить голосование.
    /// @param votesFor Количество голосов «за»
    /// @param votesAgainst Количество голосов «против»
    /// @param maxVoters Максимальное число голосующих
    /// @return true, если разница голосов превышает оставшиеся голоса
    function canFinalize(
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 maxVoters
    ) internal pure returns (bool) {
        uint256 totalVotes = votesFor + votesAgainst;
        uint256 remaining = maxVoters > totalVotes ? maxVoters - totalVotes : 0;
        if (votesFor >= votesAgainst && votesFor - votesAgainst > remaining) {
            return true;
        }
        if (votesAgainst > votesFor && votesAgainst - votesFor > remaining) {
            return true;
        }
        return false;
    }
}
