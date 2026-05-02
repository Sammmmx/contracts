//SPDX-License-Identifier:MIT

pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

//Custom Errors
error AlreadyMerchant(address _merchant);
error ZeroAddress();
error UnregisteredMerchant();
error NotOwner();
error EmptyValue();
error ExistingPlan();
error InvalidMerchant();
error InvalidID();
error Paused();
error NotPaused();
error InsufficientBalance();
error PeriodIncomplete();
error NothingToWithdraw();
error AlreadyDeactivated();
error PlanDeactivated();

/// @title SUBSCRIPTION
/// @notice A decentralized subscription management contract that handles recurring ERC20 payments between merchants and subscribers.
/// @dev Inherits ReentrancyGuard to protect against reentrancy attacks during token transfers.
///      Uses SafeERC20 to safely interact with ERC20 tokens that may not return a boolean.
contract SUBSCRIPTION is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // STATE DECLARATIONS

    /// @notice The address of the contract owner responsible for registering merchants.
    address public immutable owner;

    /// @notice The ERC20 token used as the payment currency for all subscriptions.
    IERC20 public immutable paymentToken;

    // MODIFIERS

    /// @notice Reverts if the provided address is the zero address.
    /// @param _address The address to validate.
    modifier checkAddress(address _address) {
        if (_address == address(0)) revert ZeroAddress();
        _;
    }

    /// @notice Reverts if the caller is not the contract owner.
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Reverts if the given address does not have an active subscription for the given ID.
    /// @param _address The subscriber address to check.
    /// @param _subscriptionID The subscription plan ID to check against.
    modifier checkSubscriber(address _address, uint256 _subscriptionID) {
        if (Subscribers[_address][_subscriptionID].amountPaid == 0) revert InvalidID();
        _;
    }

    /// @notice Reverts if the subscriber's renewal is currently paused.
    /// @param _address The subscriber address to check.
    /// @param _subscriptionID The subscription plan ID to check against.
    modifier checkPaused(address _address, uint256 _subscriptionID) {
        if (Subscribers[_address][_subscriptionID].paused == true) revert Paused();
        _;
    }

    /// @notice Reverts if the caller is not the merchant who owns the given subscription plan.
    /// @param _subscriptionID The subscription plan ID to check.
    /// @param _address The address to validate as the plan's merchant.
    modifier checkMerchant(uint256 _subscriptionID, address _address) {
        if (Subscriptions[_subscriptionID].merchant != _address) revert InvalidMerchant();
        _;
    }

    /// @notice Reverts if the given subscription plan has been deactivated.
    /// @param _subscriptionID The subscription plan ID to check.
    modifier checkDeactivation(uint256 _subscriptionID) {
        if (Subscriptions[_subscriptionID].deactivated == true) revert PlanDeactivated();
        _;
    }

    // STRUCTS

    /// @notice Stores the details of a subscriber's active subscription.
    /// @param merchant The address of the merchant who owns the plan.
    /// @param subscriptionName The name of the subscribed plan.
    /// @param lastBillingDate The timestamp of the most recent payment.
    /// @param nextBillingDate The timestamp when the next payment is due.
    /// @param amountPaid The price paid per billing cycle.
    /// @param paused Whether auto renewal is currently paused.
    struct subscriberDetails {
        address merchant;
        string subscriptionName;
        uint256 lastBillingDate;
        uint256 nextBillingDate;
        uint256 amountPaid;
        bool paused;
    }

    /// @notice Stores the details of a subscription plan created by a merchant.
    /// @param merchant The address of the merchant who created the plan.
    /// @param name The name of the subscription plan.
    /// @param duration The billing cycle length in days.
    /// @param price The cost per billing cycle in payment tokens.
    /// @param toWithdraw The accumulated amount available for the merchant to withdraw.
    /// @param deactivated Whether the plan has been deactivated and is no longer open for new subscriptions.
    struct subscriptionDetails {
        address merchant;
        string name;
        uint256 duration;
        uint256 price;
        uint256 toWithdraw;
        bool deactivated;
    }

    // MAPPINGS

    /// @notice Maps a subscriber address and plan ID to their subscription details.
    mapping(address => mapping(uint256 => subscriberDetails)) public Subscribers;

    /// @notice Maps a plan ID to its subscription details.
    mapping(uint256 => subscriptionDetails) public Subscriptions;

    /// @notice Tracks whether an address is a registered merchant.
    mapping(address => bool) public isMerchant;

    //EVENTS

    /// @notice Emitted when a subscriber successfully purchases a subscription.
    /// @param _purchaser The address of the subscriber.
    /// @param _merchant The address of the merchant.
    /// @param _name The name of the subscription plan.
    event SubscriptionsPurchased(address _purchaser, address _merchant, string _name);

    /// @notice Emitted when a subscriber cancels their subscription.
    /// @param _subscriber The address of the subscriber.
    /// @param _merchant The address of the merchant.
    /// @param _name The name of the subscription plan.
    event Cancellations(address _subscriber, address _merchant, string _name);

    /// @notice Emitted when a merchant defines a new subscription plan.
    /// @param _merchant The address of the merchant.
    /// @param _name The name of the plan.
    /// @param _duration The billing cycle duration in days.
    /// @param _price The price per billing cycle in payment tokens.
    event PlansDefined(address _merchant, string _name, uint256 _duration, uint256 _price);

    /// @notice Emitted when a new merchant is registered by the owner.
    /// @param _merchant The address of the newly registered merchant.
    event MerchantRegistered(address _merchant);

    /// @notice Emitted when a subscription is successfully auto renewed.
    /// @param _subscriber The address of the subscriber.
    /// @param _merchant The address of the merchant who triggered the renewal.
    /// @param _name The name of the subscription plan.
    event AutoRenewals(address _subscriber, address _merchant, string _name);

    /// @notice Emitted when a subscriber pauses their auto renewal.
    /// @param _subscriber The address of the subscriber.
    /// @param _merchant The address of the merchant.
    /// @param _name The name of the subscription plan.
    event PausedRenewal(address _subscriber, address _merchant, string _name);

    /// @notice Emitted when a subscriber resumes their auto renewal.
    /// @param _subscriber The address of the subscriber.
    /// @param _merchant The address of the merchant.
    /// @param _name The name of the subscription plan.
    event ResumedRenewal(address _subscriber, address _merchant, string _name);

    /// @notice Emitted when a merchant deactivates a subscription plan.
    /// @param _merchant The address of the merchant.
    /// @param _subscriptionID The ID of the deactivated plan.
    event PlansDeactivated(address _merchant, uint256 _subscriptionID);

    // UNIQUE IDENTIFICATION NUMBERING

    /// @dev Internal counter for assigning unique IDs to subscription plans. Starts at 1 to avoid conflict with zero-value checks.
    uint256 subscriptionIdCount = 1;

    //DEPLOYMENT

    /// @notice Deploys the subscription contract with a designated owner and payment token.
    /// @param _owner The address of the contract owner who can register merchants.
    /// @param _token The address of the ERC20 token used for payments.
    constructor(address _owner, address _token) checkAddress(_owner) {
        owner = _owner;
        paymentToken = IERC20(_token);
    }

    // OWNER FUNCTIONS

    /// @notice Registers a new merchant, allowing them to create subscription plans.
    /// @dev Only callable by the contract owner. Reverts if the address is zero or already registered.
    /// @param _merchant The address to register as a merchant.
    function registerMerchant(address _merchant) public 
    onlyOwner()
    checkAddress(_merchant) {
        if (isMerchant[_merchant] == true) revert AlreadyMerchant(_merchant);
        isMerchant[_merchant] = true;

        emit MerchantRegistered(_merchant);
    }

    // MERCHANT INTERACTIONS

    /// @notice Creates a new subscription plan with a name, duration, and price.
    /// @dev Only callable by registered merchants. Plan ID is auto-assigned and incremented.
    /// @param _name The name of the subscription plan.
    /// @param _duration The billing cycle length in days.
    /// @param _price The cost per billing cycle in payment tokens.
    function definePlan(string memory _name, uint256 _duration, uint256 _price) public {
        if (isMerchant[msg.sender] == false) revert UnregisteredMerchant();
        if (bytes (_name).length == 0) revert EmptyValue();
        if (_duration == 0) revert EmptyValue();
        if (_price == 0) revert EmptyValue();
        Subscriptions[subscriptionIdCount] = subscriptionDetails ({
            merchant: msg.sender,
            name: _name,
            duration: _duration,
            price: _price,
            toWithdraw: 0,
            deactivated: false
        });
        subscriptionIdCount++;

        emit PlansDefined(msg.sender, _name, _duration, _price);
    }

    /// @notice Triggers an auto renewal for a subscriber once their billing period has ended.
    /// @dev Only callable by the merchant who owns the plan. Reverts if the plan is deactivated,
    ///      the subscription is paused, or the billing period has not yet elapsed.
    /// @param _subscriber The address of the subscriber to renew.
    /// @param subscriptionID The ID of the subscription plan.
    function autoRenewal(address _subscriber, uint256 subscriptionID) public 
    checkDeactivation(subscriptionID)
    checkMerchant(subscriptionID, msg.sender) 
    checkSubscriber(_subscriber, subscriptionID)
    checkPaused(_subscriber, subscriptionID) {
        if (block.timestamp < Subscribers[_subscriber][subscriptionID].nextBillingDate) revert PeriodIncomplete();

        completeSubscription(subscriptionID, _subscriber);
        emit AutoRenewals(_subscriber, msg.sender, Subscriptions[subscriptionID].name);
    }

    /// @notice Allows a merchant to withdraw accumulated subscription payments for a plan.
    /// @dev Resets the toWithdraw balance to zero before transferring to prevent double withdrawal.
    /// @param subscriptionID The ID of the subscription plan to withdraw earnings from.
    function merchantWithdrawal(uint256 subscriptionID) public 
    checkMerchant(subscriptionID, msg.sender) {
        uint256 _toWithdraw = Subscriptions[subscriptionID].toWithdraw;
        if(_toWithdraw == 0) revert NothingToWithdraw();
        Subscriptions[subscriptionID].toWithdraw = 0;
        IERC20(paymentToken).safeTransfer(msg.sender, _toWithdraw);
    }

    /// @notice Deactivates a subscription plan, preventing new subscriptions and auto renewals.
    /// @dev Only callable by the merchant who owns the plan. Existing subscribers are unaffected.
    /// @param _subscriptionID The ID of the plan to deactivate.
    function deactivatePlan(uint256 _subscriptionID) public 
    checkMerchant(_subscriptionID, msg.sender) {
        if (Subscriptions[_subscriptionID].deactivated == true) revert AlreadyDeactivated();
        Subscriptions[_subscriptionID].deactivated = true;

        emit PlansDeactivated(msg.sender, _subscriptionID);
    }

    // CUSTOMER INTERACTIONS

    /// @notice Subscribes the caller to a plan and processes the first payment.
    /// @dev Requires the caller to have approved this contract to spend the plan's price in payment tokens.
    ///      Reverts if the plan is deactivated, does not exist, or the caller is already subscribed.
    /// @param subscriptionID The ID of the subscription plan to subscribe to.
    function subscribe(uint256 subscriptionID) public 
    checkDeactivation(subscriptionID) {
        uint256 _price = Subscriptions[subscriptionID].price;
        if (_price == 0) revert InvalidID();
        if (Subscribers[msg.sender][subscriptionID].amountPaid > 0) revert ExistingPlan();
        address _merchant = Subscriptions[subscriptionID].merchant;
        completeSubscription(subscriptionID, msg.sender);
        emit SubscriptionsPurchased(msg.sender, _merchant, Subscriptions[subscriptionID].name);
    }

    /// @notice Pauses auto renewal for the caller's subscription.
    /// @dev The subscription remains active but the merchant cannot trigger auto renewals while paused.
    /// @param subscriptionID The ID of the subscription plan to pause.
    function pauseRenewal(uint256 subscriptionID) public  
    checkSubscriber(msg.sender, subscriptionID) 
    checkPaused(msg.sender, subscriptionID) {
        Subscribers[msg.sender][subscriptionID].paused = true;

        emit PausedRenewal(msg.sender, Subscriptions[subscriptionID].merchant, Subscriptions[subscriptionID].name);
    }

    /// @notice Resumes auto renewal for the caller's paused subscription.
    /// @dev If the billing date has already passed at the time of resumption, an immediate payment is charged.
    ///      Reverts if the plan has been deactivated.
    /// @param subscriptionID The ID of the subscription plan to resume.
    function resumeRenewal(uint256 subscriptionID) public 
    checkDeactivation(subscriptionID) 
    checkSubscriber(msg.sender, subscriptionID) {
        if (Subscribers[msg.sender][subscriptionID].paused == false) revert NotPaused();
        Subscribers[msg.sender][subscriptionID].paused = false;
        if (Subscribers[msg.sender][subscriptionID].nextBillingDate < block.timestamp) {
            completeSubscription(subscriptionID, msg.sender);
        }

        emit ResumedRenewal(msg.sender, Subscriptions[subscriptionID].merchant, Subscriptions[subscriptionID].name);
    }

    /// @notice Cancels the caller's subscription and resets all associated data.
    /// @dev Does not issue a refund for the current billing period. The subscriber can resubscribe after cancellation.
    /// @param subscriptionID The ID of the subscription plan to cancel.
    function cancelSubscription(uint256 subscriptionID) public  
    checkSubscriber(msg.sender, subscriptionID) {
        string memory _name = Subscriptions[subscriptionID].name;
        address _merchant = Subscriptions[subscriptionID].merchant;
        Subscribers[msg.sender][subscriptionID] = subscriberDetails({
            merchant: address(0),
            subscriptionName: "",
            lastBillingDate: 0,
            nextBillingDate: 0,
            amountPaid: 0,
            paused: false
        });

        emit Cancellations(msg.sender, _merchant, _name);
    }

    // INTERNAL FUNCTIONS

    /// @notice Processes a subscription payment and updates subscriber state.
    /// @dev Transfers payment tokens from the subscriber to the contract using safeTransferFrom.
    ///      Updates the last and next billing dates based on the plan duration.
    ///      Accumulates the payment in toWithdraw for the merchant to claim later.
    /// @param subscriptionID The ID of the subscription plan being processed.
    /// @param _subscriber The address of the subscriber being charged.
    function completeSubscription(uint256 subscriptionID, address _subscriber) internal {
        uint256 _amount = Subscriptions[subscriptionID].price;
        if (IERC20(paymentToken).balanceOf(_subscriber) < _amount) revert InsufficientBalance();
        address _merchant = Subscriptions[subscriptionID].merchant;
        string memory _name = Subscriptions[subscriptionID].name;
        uint256 _duration = Subscriptions[subscriptionID].duration;
        Subscribers[_subscriber][subscriptionID] = subscriberDetails ({
            merchant: _merchant,
            subscriptionName: _name, 
            lastBillingDate: block.timestamp,
            nextBillingDate: block.timestamp + (_duration * 1 days),
            amountPaid: _amount,
            paused: false
        });

        Subscriptions[subscriptionID].toWithdraw += _amount;

        IERC20(paymentToken).safeTransferFrom(_subscriber, address(this), _amount);
    }
}
