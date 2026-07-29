// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ICooperativeRegistry
 * @notice Cross-contract interface for RotationManager ↔ CooperativeRegistry.
 */
interface ICooperativeRegistry {
    enum PayoutStrategy {
        JoinOrder,
        RandomDraw,
        OrganizerAssigned,
        GovernanceVote
    }

    enum CoopStatus {
        Active,
        Paused,
        Closed
    }

    enum ContributionStatus {
        Waiting,
        Paid,
        Exempt
    }

    enum ContributionFrequency {
        Weekly,
        BiWeekly,
        Monthly
    }

    struct Cooperative {
        uint256 id;
        string name;
        string description;
        address organizer;
        address treasuryVault;
        address loanPool;
        uint256 contributionAmount;
        ContributionFrequency contributionFrequency;
        uint32 maxMembers;
        uint32 memberCount;
        PayoutStrategy payoutStrategy;
        uint32 currentRotationIndex; // 1-based join position of current recipient
        CoopStatus status;
        uint64 createdAt;
        bool exists;
    }

    struct Member {
        address wallet;
        string displayName;
        uint64 joinedAt;
        uint32 joinPosition;
        ContributionStatus contributionStatus;
        bool isCurrentRecipient;
        bool loanEligible;
        uint16 governanceScore;
        uint16 creditScore;
        bool active;
        bool exists;
    }

    function getCooperative(uint256 coopId) external view returns (Cooperative memory);

    function getMembers(uint256 coopId) external view returns (address[] memory);

    function getMember(uint256 coopId, address account) external view returns (Member memory);

    function getMemberPosition(uint256 coopId, address account) external view returns (uint32);

    function isMember(uint256 coopId, address account) external view returns (bool);

    function memberByPosition(uint256 coopId, uint32 position) external view returns (address);

    function nextJoinPosition(uint256 coopId) external view returns (uint32);

    function advanceRotationIndex(uint256 coopId, uint32 newIndex) external;

    function setCurrentRecipientFlags(uint256 coopId, address previous, address current) external;

    function markMemberSkipped(uint256 coopId, address member) external;

    function rotationManager() external view returns (address);
}
