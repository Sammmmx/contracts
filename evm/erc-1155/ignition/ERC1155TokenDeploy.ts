import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ERC1155Token", (m) => {
  const deployer = m.getAccount(0);
  const minter = m.getAccount(1);
  const uriSetter = m.getAccount(2);

  const erc1155 = m.contract("ERC1155Token", [deployer, minter, uriSetter]);

  return { erc1155 };
});
