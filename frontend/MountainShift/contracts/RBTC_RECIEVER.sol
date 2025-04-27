// V2 Contract for Rootstock!!!  
// RBTC deposits tracked & logged for backend execution—NO direct swaps!!!  
// Users deposit RBTC, backend handles RBTC payout post-validation.  

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PPshiftRBTC {
    address public owner;

    /// @notice Logs RBTC deposits!!! Backend listens to this event.  
    /// @param rbtcAmount Amount deposited.  
    /// @param depositor Who deposited.  
    /// @param recipient Where RBTC should go.  
    /// @param proof Extra security parameter (optional).  
    event DepositProcessed(
        uint256 rbtcAmount,
        address indexed depositor,
        address indexed recipient,
        bytes proof
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized!!!");
        _;
    }

    /// @notice Contract initialized with owner.  
    constructor() {
        owner = msg.sender;
    }

    /// @notice Users deposit RBTC—backend listens to event logs.  
    /// @param recipient Where RBTC should go.  
    /// @param proof Extra validation data (optional).  
    function depositRBTC(address recipient, bytes calldata proof) external payable {
        require(msg.value > 0, "Invalid amount!!!");
        require(recipient != address(0), "Invalid recipient!!!");

        // Emit event so backend knows what happened!!!  
        emit DepositProcessed(msg.value, msg.sender, recipient, proof);
    }

    /// @notice Owner can withdraw stuck RBTC if needed.  
    function withdrawFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw!!!");

        // Send RBTC to the owner!!!  
        (bool success, ) = owner.call{value: balance}("");
        require(success, "RBTC transfer failed!!!");
    }

    /// @notice Allows contract to receive RBTC.  
    receive() external payable {}
}
