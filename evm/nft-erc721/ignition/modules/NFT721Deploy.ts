import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("NFT721", (m) => {
  const deployer = m.getAccount(0);

  const Name = m.getParameter("name", "Artemis");
  const Symbol = m.getParameter("symbol", "ATM");
  const Fee = m.getParameter("defaultFee", 500);

  const nft = m.contract("NFT721", [Name, Symbol, deployer, Fee]);

  return { nft };
});
