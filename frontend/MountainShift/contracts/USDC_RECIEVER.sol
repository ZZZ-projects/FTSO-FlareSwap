// V2 Contract!  
// USDC deposits tracked & logged for backend execution—NO direct swaps!!!  
// Users approve & deposit USDC, backend handles RBTC payout post-validation.  

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @notice Minimal ERC20 interface for USDC  
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PPshiftV2 {
    address public owner;
    IERC20 public usdcToken;  // USDC on Optimism.

    /// @notice Logs deposits!!! Backend listens to this event.  
    /// @param usdcAmount Amount deposited.  
    /// @param depositor Who deposited.  
    /// @param recipient Where RBTC should go.  
    /// @param proof Extra security parameter (optional).  
    event DepositProcessed(
        uint256 usdcAmount,
        address indexed depositor,
        address indexed recipient,
        bytes proof
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized!!!");
        _;
    }

    /// @notice Contract initialized with USDC token address.  
    constructor(address _usdcToken) {
        require(_usdcToken != address(0), "Invalid USDC token address!!!");
        owner = msg.sender;
        usdcToken = IERC20(_usdcToken);
    }

    /// @notice Users approve & deposit USDC—backend listens to event logs.  
    /// @param usdcAmount Amount to deposit.  
    /// @param recipient Where RBTC should go.  
    /// @param proof Extra validation data (optional).  
    function depositUSDC(uint256 usdcAmount, address recipient, bytes calldata proof) external {
        require(usdcAmount > 0, "Invalid amount!!!");
        require(recipient != address(0), "Invalid recipient!!!");

        // Transfer USDC from sender to contract!!!  
        require(usdcToken.transferFrom(msg.sender, address(this), usdcAmount), "USDC transfer failed!!!");

        // Emit event so backend knows what happened!!!  
        emit DepositProcessed(usdcAmount, msg.sender, recipient, proof);
    }

    /// @notice Owner can withdraw stuck USDC if needed.  
    function withdrawFunds() external onlyOwner {
        uint256 balance = usdcToken.balanceOf(address(this));
        require(balance > 0, "No funds to withdraw!!!");
        require(usdcToken.transfer(owner, balance), "USDC transfer failed!!!");
    }
}
