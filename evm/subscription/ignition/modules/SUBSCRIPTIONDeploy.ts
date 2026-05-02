import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("SubscriptionModule", (m) => {
  const deployer = m.getAccount(0);

  // Address of the already deployed ERC20 payment token
  const tokenAddress = m.getParameter("tokenAddress");

  const subscription = m.contract("SUBSCRIPTION", [deployer, tokenAddress]);

  return { subscription };
});
