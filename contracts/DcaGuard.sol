pragma solidity ^0.8.20;

contract DcaGuard {
    address public owner;
    uint256 public windowStart;
    uint256 public windowEnd;
    uint256 public maxBuyValue;
    uint256 public maxTotalSpend;
    uint256 public maxBuys;
    uint256 public totalSpent;
    uint256 public buysExecuted;
    bool public paused;
    mapping(address => bool) public allowlist;

    event BuyExecuted(address indexed target, uint256 value);
    event BuyBlocked(address indexed target, uint256 value, string reason);
    event Paused(string reason);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(
        uint256 start,
        uint256 end,
        uint256 maxValue,
        uint256 maxTotal,
        uint256 maxCount,
        address allowedTarget
    ) {
        owner = msg.sender;
        windowStart = start;
        windowEnd = end;
        maxBuyValue = maxValue;
        maxTotalSpend = maxTotal;
        maxBuys = maxCount;
        paused = false;
        allowlist[allowedTarget] = true;
    }

    function setPaused(bool value, string calldata reason) external onlyOwner {
        paused = value;
        if (value) {
            emit Paused(reason);
        }
    }

    function buy(address target, uint256 value) external onlyOwner returns (bool) {
        if (paused) {
            emit BuyBlocked(target, value, "paused");
            return false;
        }
        if (block.timestamp < windowStart || block.timestamp > windowEnd) {
            paused = true;
            emit BuyBlocked(target, value, "outside window");
            emit Paused("outside window");
            return false;
        }
        if (!allowlist[target]) {
            paused = true;
            emit BuyBlocked(target, value, "target not allowlisted");
            emit Paused("target not allowlisted");
            return false;
        }
        if (value == 0 || value > maxBuyValue) {
            paused = true;
            emit BuyBlocked(target, value, "over value limit");
            emit Paused("over value limit");
            return false;
        }
        if (totalSpent + value > maxTotalSpend) {
            paused = true;
            emit BuyBlocked(target, value, "over total limit");
            emit Paused("over total limit");
            return false;
        }
        if (buysExecuted >= maxBuys) {
            paused = true;
            emit BuyBlocked(target, value, "max buys reached");
            emit Paused("max buys reached");
            return false;
        }
        totalSpent += value;
        buysExecuted += 1;
        emit BuyExecuted(target, value);
        return true;
    }
}
