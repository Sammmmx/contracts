import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("multisigModule", (m) => {
  const Signer1 = m.getAccount(0);
  const Signer2 = m.getAccount(1);
  const Signer3 = m.getAccount(2);
  const Account1 = m.getAccount(3);
  const Account2 = m.getAccount(4);
  const Account3 = m.getAccount(5);
  const Threshold = m.getParameter("_threshold", 2);

  const multiSig = m.contract("multisig", [
    [Signer1, Signer2, Signer3, Account1, Account2, Account3],
    Threshold,
  ]);

  return { multiSig };
});
