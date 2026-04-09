// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

//Custom Errors
error NotSigner(address account);
    error AlreadySigner(address account);
    error NotEnoughSigners();
    error InvalidThreshold();
    error InputNotRequired();
    error AddressNotRequired();
    error TxNonExistent();
    error TxNotPending();
    error AlreadyConfirmed();
    error NotConfirmed();
    error ThresholdNotMet();
    error ExecutionFailed();
    error InvalidAddress();
    error TokenNotRequired();
    error EmptyTransaction();
    error UnknownTokenAddress();
    error InvalidTransactionType();
    error InsufficientFunds();
    error NotProposer();

/// @title Multisig Wallet
/// @notice Multi-signature wallet supporting ETH, ERC20 transfers and signer management
/// @dev Uses SafeERC20 and ReentrancyGuard for secure execution
contract Multisig is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Emitted when ETH is deposited into contract
    /// @param sender Address sending ETH
    /// @param amount Amount of ETH deposited
    event Deposit(address indexed sender, uint256 amount);
    event Submitted(uint256 _txId, address caller, address receiver, uint256 amount);
    event Confirmed(uint256 indexed txId, address indexed signer);

    /// @notice Emitted when a transaction is executed
    /// @param txId Transaction ID
    event Executed(uint256 indexed txId);

    /// @notice Transaction types supported by multisig
    enum TxType { ETH, ERC20, ADD_SIGNER, REMOVE_SIGNER, THRESHOLD }

    /// @notice Transaction states
    enum States { NONE, PENDING, EXECUTED, CANCELLED }

    /// @notice Transaction structure
    /// @param to Target address
    /// @param token ERC20 token address
    /// @param value ETH or token amount
    /// @param txType Transaction type
    /// @param state Transaction state
    /// @param propser Caller Address
    struct Transaction {
        address to;
        address token;
        uint256 value;
        TxType txType;
        States state;
        address proposer;
    }

    /// @notice List of signer addresses
    address[] public signers;

    /// @notice Mapping to check signer status
    mapping(address => bool) public isSigner;

    /// @notice Tracks confirmations for transactions
    mapping(uint256 => mapping(address => bool)) public hasConfirmed;

    /// @notice List of submitted transactions
    Transaction[] public transactions;

    /// @notice Required confirmations for execution
    uint256 public threshold;

    /// @notice Restricts function access to signers only
    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert NotSigner(msg.sender);
        _;
    }

    /// @notice Initializes multisig wallet
    /// @param _signers Initial signer addresses
    /// @param _threshold Required confirmation threshold
    constructor(address[] memory _signers, uint256 _threshold) {
        uint256 len = _signers.length;
        require(len >= 2, NotEnoughSigners());
        require(_threshold >= 2 && _threshold <= len, InvalidThreshold());
        for (uint256 i = 0; i < len; i++) {
            address signer = _signers[i];
            require(signer != address(0), InvalidAddress());
            require(!isSigner[signer], AlreadySigner(signer));

            isSigner[signer] = true;
            signers.push(signer);
        }
        threshold = _threshold;
    }

    /// @notice Receive ETH deposits
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    /// @notice Submit a new transaction
    /// @param _to Target address
    /// @param _token Token address (if ERC20)
    /// @param _value Amount to transfer
    /// @param _typeindex The index of the transaction type (0-4)
    function submit(address _to, address _token, uint256 _value, uint8 _typeindex) public onlySigner {
        require(_typeindex <= uint8(TxType.THRESHOLD), InvalidTransactionType());

        TxType _type = TxType(_typeindex);
    
        if (_type == TxType.ETH) {
            require(_to != address(0), InvalidAddress());
            require(_token == address(0), TokenNotRequired());
            require(_value > 0, EmptyTransaction());
        } 
        else if (_type == TxType.ERC20) {
            require(_to != address(0), InvalidAddress());
            require(_token != address(0), UnknownTokenAddress());
            require(_value > 0, EmptyTransaction());
        } 
        else if (_type == TxType.ADD_SIGNER) {
            require(_to != address(0), InvalidAddress());
            require(!isSigner[_to], AlreadySigner(_to));
            require(_token == address(0) && _value == 0, InputNotRequired());
        } 
        else if (_type == TxType.REMOVE_SIGNER) {
            require(isSigner[_to], NotSigner(_to));
            require(_token == address(0) && _value == 0, InputNotRequired());
        } 
        else if (_type == TxType.THRESHOLD) {
            require(_value > 0, InvalidThreshold());
            require(_to == address(0) && _token == address(0), AddressNotRequired());
        }

    // --- State Update ---

        uint256 txId = transactions.length;
        transactions.push(Transaction({
            to: _to,
            token: _token,
            value: _value,
            txType: _type,
            state: States.PENDING,
            proposer: msg.sender
        }));

    _tryAutoConfirm(txId);
    emit Submitted(txId, msg.sender, _to, _value);
    }


    /// @notice Confirm a transaction
    /// @param _txId Transaction ID
    function confirm(uint256 _txId) public onlySigner {
        require(_txId < transactions.length, TxNonExistent());
        require(transactions[_txId].state == States.PENDING, TxNotPending());
        require(!hasConfirmed[_txId][msg.sender], AlreadyConfirmed());

        hasConfirmed[_txId][msg.sender] = true;

        emit Confirmed(_txId, msg.sender);
    }

    /// @notice Revoke a confirmation
    /// @param _txId Transaction ID
    function revoke(uint256 _txId) public onlySigner {
        require(_txId < transactions.length, TxNonExistent());
        require(transactions[_txId].state == States.PENDING, TxNotPending());
        require(hasConfirmed[_txId][msg.sender], NotConfirmed());

        hasConfirmed[_txId][msg.sender] = false;
    }

    /// @notice Cancel a transaction
    /// @param _txId Transaction ID
    function cancel(uint256 _txId) public onlySigner {
        require(_txId < transactions.length, TxNonExistent());
        Transaction storage t = transactions[_txId];
        require(t.state == States.PENDING, TxNotPending());

        require(msg.sender == t.proposer, NotProposer());
        
        transactions[_txId].state = States.CANCELLED;
    }

    /// @notice Execute transaction after threshold confirmations
    /// @param _txId Transaction ID
    function execute(uint256 _txId) public nonReentrant {
        require(_txId < transactions.length, TxNonExistent());
        Transaction storage t = transactions[_txId];
        
        require(t.state == States.PENDING, TxNotPending());

        uint256 activeConfirmations = 0;
        for (uint256 i = 0; i < signers.length; i++) {
            if (hasConfirmed[_txId][signers[i]]) {
                activeConfirmations++;
            }
        }
        require(activeConfirmations >= threshold, ThresholdNotMet());

        t.state = States.EXECUTED;

        if (t.txType == TxType.ETH) {
            require(address(this).balance >= transactions[_txId].value, InsufficientFunds());
            (bool success, ) = t.to.call{value: t.value}("");
            require(success, ExecutionFailed());
        } 
        else if (t.txType == TxType.ERC20) {
            IERC20(t.token).safeTransfer(t.to, t.value);
        }
        else if (t.txType == TxType.ADD_SIGNER) {
            isSigner[t.to] = true;
            signers.push(t.to);
        }
        else if (t.txType == TxType.REMOVE_SIGNER) {
            _removeSigner(t.to);
        }
        else if (t.txType == TxType.THRESHOLD) {
            require(t.value >= 2 && t.value <= signers.length, InvalidThreshold());
            threshold = t.value;
        }

        emit Executed(_txId);
    }

    /// @notice Automatically confirms submitted transaction
    /// @param _txId Transaction ID
    function _tryAutoConfirm(uint256 _txId) internal {
        if (isSigner[msg.sender]) {
            confirm(_txId);
        }
    }

    /// @notice Removes a signer
    /// @param _signer Signer address to remove
    function _removeSigner(address _signer) internal {
        isSigner[_signer] = false;
        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == _signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }
        if (threshold > signers.length) {
            threshold = signers.length < 2 ? 2 : signers.length;
        }
    }
}