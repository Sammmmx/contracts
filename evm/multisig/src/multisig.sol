//SPDX-License-Identifier:MIT

pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Custom errors
error NotSigner(address caller);
error ExistingSigner();
error NotEnoughSigners();

error ThresholdNotMet();
error InvalidThreshold();
error SignersEqualThreshold(uint256 length);

error InvalidTransactionType();
error TransactionFailed();
error InsufficientFunds();
error EmptyTransaction();

error InvalidId();
error InputNotRequired();
error InvalidAddress();
error UnknownTokenAddress();
error RedundancyDetected();
error AddressNotRequired();
error AlreadyConfirmed();
error TokenNotRequired();

contract multisig {

    enum Tx_Type{NONE, ETH, ERC20, ADD_SIGNER, REMOVE_SIGNER, THRESHOLD}
    enum States{NONE, PENDING, EXECUTED}

    struct TxDetails {
        address _address;
        address token;
        uint256 approvals;
        uint256 amount;
        Tx_Type _type;
        States _state;
    }

    address[] public Signers;
    uint256 public Threshold;

    mapping(address => bool) public isSigner;
    mapping(uint256 => TxDetails) public Transactions;
    mapping(uint256 => mapping(address => bool)) public hasConfirmed;

    uint256 private IdCount = 1;

    event Submitted(uint256 indexed txId, address indexed submitter, Tx_Type _type);
    event Confirmed(uint256 indexed txId, address indexed signer);
    event Execute(address to, address token, uint256 _amount, uint256 approvals, Tx_Type _type, States state);

    constructor(address[] memory _Signers, uint256 _threshold) {
        for(uint256 i = 0; i < _Signers.length; i++) {
            if (_Signers[i] == address(0)) revert InvalidAddress();
            for(uint256 j = i + 1; j < _Signers.length; j++) {
                if (_Signers[i] == _Signers[j]) revert RedundancyDetected();
            }
        }
        require(_Signers.length >= 2, NotEnoughSigners());
        require(_threshold >= 2 && _threshold <= _Signers.length, InvalidThreshold());

        uint256 len = _Signers.length;
        for(uint256 i = 0; i < len; i++) {
            Signers.push(_Signers[i]);
            isSigner[_Signers[i]] = true;
        }
        Threshold = _threshold;
    }

    modifier checkId(uint256 _ID) {
        require(Transactions[_ID]._state == States.PENDING, InvalidId());
        _;
    }

    modifier checkSigner(address _Signer) {
        if(!isSigner[_Signer]) revert NotSigner(msg.sender);
        _;
    }

    function getSigners() public view returns (address[] memory) {
        return Signers;
    }

    function addSigner(address newSigner) internal {
        require(!isSigner[newSigner], ExistingSigner());
        Signers.push(newSigner);
        isSigner[newSigner] = true;
    }

    function removeSigner(address _Signer) internal
    checkSigner(_Signer) {
        uint256 len = Signers.length;
        if(Threshold == len) revert SignersEqualThreshold(len);
        for(uint256 i = 0; i < len; i++) {
            if(Signers[i] == _Signer) {
                Signers[i] = Signers[len-1];
                Signers.pop();
                break;
            }
        }
        isSigner[_Signer] = false;
    }

    function updateThreshold(uint256 newThreshold) internal {
        require(newThreshold <= Signers.length && newThreshold >= 2, InvalidThreshold());
        Threshold = newThreshold;
    }

    function transferETH(address _to, uint256 _amount) internal {
        require(address(this).balance >= _amount, InsufficientFunds());
        (bool success, ) = _to.call{value:_amount}("");
        require(success, TransactionFailed());
    }

    function transferERC20(address _token, address _to, uint256 _amount) internal {
        bool success = IERC20(_token).transfer(_to, _amount);
        require(success, TransactionFailed());
    }

    function _tryAutoConfirm(uint256 _id) private {
        if(isSigner[msg.sender]) {
            hasConfirmed[_id][msg.sender] = true;
            Transactions[_id].approvals++;
        }
    }

    function Submit(address _address, address _token, uint256 input, Tx_Type _type) public {
        require(_type != Tx_Type.NONE, InvalidTransactionType());

        if(_type == Tx_Type.ETH) {
            require(_address != address(0), InvalidAddress());
            require(input > 0, EmptyTransaction());
            require(_token == address(0), TokenNotRequired());
            Transactions[IdCount] = TxDetails(_address, _token, 0, input, _type, States.PENDING);

        } else if(_type == Tx_Type.ERC20) {
            require(_address != address(0), InvalidAddress());
            require(input > 0, EmptyTransaction());
            require(_token != address(0), UnknownTokenAddress());
            Transactions[IdCount] = TxDetails(_address, _token, 0, input, _type, States.PENDING);

        } else if(_type == Tx_Type.ADD_SIGNER || _type == Tx_Type.REMOVE_SIGNER) {
            require(input == 0, InputNotRequired());
            require(_token == address(0), TokenNotRequired());
            if(_type == Tx_Type.ADD_SIGNER) {
                require(!isSigner[_address], ExistingSigner());
            } else {
                require(isSigner[_address], NotSigner(msg.sender));
            }
            Transactions[IdCount] = TxDetails(_address, _token, 0, input, _type, States.PENDING);

        } else {
            require(_address == address(0), AddressNotRequired());
            require(input > 0, InvalidThreshold());
            require(_token == address(0), TokenNotRequired());
            Transactions[IdCount] = TxDetails(_address, _token, 0, input, _type, States.PENDING);
        }

        _tryAutoConfirm(IdCount);
        emit Submitted(IdCount, msg.sender, _type);
        IdCount++;
    }

    function confirm(uint256 _txId) public
    checkSigner(msg.sender)
    checkId(_txId) {
        require(!hasConfirmed[_txId][msg.sender], AlreadyConfirmed());
        hasConfirmed[_txId][msg.sender] = true;
        Transactions[_txId].approvals++;
        emit Confirmed(_txId, msg.sender);
    }

    function execute(uint256 _txId) public
    checkId(_txId) {
        uint256 approvals = Transactions[_txId].approvals;
        require(approvals >= Threshold, ThresholdNotMet());
        Tx_Type current = Transactions[_txId]._type;

        if(current == Tx_Type.ETH) {
            address _to = Transactions[_txId]._address;
            uint256 Amount = Transactions[_txId].amount;
            Transactions[_txId]._state = States.EXECUTED;
            transferETH(_to, Amount);
            emit Execute(_to, address(0), Amount, approvals, current, States.EXECUTED);

        } else if(current == Tx_Type.ERC20) {
            address _to = Transactions[_txId]._address;
            address _token = Transactions[_txId].token;
            uint256 Amount = Transactions[_txId].amount;
            Transactions[_txId]._state = States.EXECUTED;
            transferERC20(_token, _to, Amount);
            emit Execute(_to, _token, Amount, approvals, current, States.EXECUTED);

        } else if(current == Tx_Type.ADD_SIGNER || current == Tx_Type.REMOVE_SIGNER) {
            address signer = Transactions[_txId]._address;
            Transactions[_txId]._state = States.EXECUTED;
            if(current == Tx_Type.ADD_SIGNER) {
                addSigner(signer);
            } else {
                removeSigner(signer);
            }
            emit Execute(signer, address(0), 0, approvals, current, States.EXECUTED);

        } else {
            uint256 _newThreshold = Transactions[_txId].amount;
            Transactions[_txId]._state = States.EXECUTED;
            updateThreshold(_newThreshold);
            emit Execute(address(0), address(0), _newThreshold, approvals, current, States.EXECUTED);
        }
    }

    receive() external payable{}
}
