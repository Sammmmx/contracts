import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenERC20Module", (m) => {
  const deployer = m.getAccount(0); //Owner will always be the address that deployed the contract

  // configurable parameters — pass these at deploy time or use defaults
  const name = m.getParameter("name", "MyToken");
  const symbol = m.getParameter("symbol", "MTK");
  const maxSupply = m.getParameter("maxSupply", 1000000n * 10n ** 18n);

  const token = m.contract("TokenERC20", [deployer, name, symbol, maxSupply]);

  return { token };
});
