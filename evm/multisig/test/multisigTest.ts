import { expect } from "chai";
import { ethers } from "hardhat";
import { TokenERC20 } from "../typechain-types";
import { Multisig } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("multisig", async function () {
  let multiSig: Multisig;
  let Signer1: HardhatEthersSigner;
  let Signer2: HardhatEthersSigner;
  let Signer3: HardhatEthersSigner;
  let Account1: HardhatEthersSigner;
  let Account2: HardhatEthersSigner;
  let Account3: HardhatEthersSigner;

  let token: TokenERC20;
  const NAME = "MyToken";
  const SYMBOL = "MTK";
  const MAX_SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [Signer1, Signer2, Signer3, Account1, Account2, Account3] =
      await ethers.getSigners();

    const MultiSig = await ethers.getContractFactory("multisig");
    multiSig = (await MultiSig.deploy(
      [Signer1.address, Signer2.address, Signer3.address],
      2,
    )) as Multisig;

    const Token = await ethers.getContractFactory("TokenERC20");
    token = (await Token.deploy(
      Signer1.address,
      NAME,
      SYMBOL,
      MAX_SUPPLY,
    )) as TokenERC20;

    await token.mint(multiSig.target, ethers.parseEther("1000"));
  });

  // Deployment Tests

  describe("Deployment", async function () {
    it("should revert if address input is 0", async function () {
      const MultiSig = await ethers.getContractFactory("multisig");
      await expect(
        MultiSig.deploy(
          [Signer1.address, ethers.ZeroAddress, Signer2.address],
          2,
        ),
      ).to.be.revertedWithCustomError(MultiSig, "InvalidAddress");
    });

    it("should revert if Redundancy is Detected", async function () {
      const MultiSig = await ethers.getContractFactory("multisig");
      await expect(
        MultiSig.deploy([Signer1.address, Signer2.address, Signer2.address], 2),
      ).to.be.revertedWithCustomError(MultiSig, "RedundancyDetected");
    });

    it("should revert if Signers list is less than 2", async function () {
      const MultiSig = await ethers.getContractFactory("multisig");
      await expect(
        MultiSig.deploy([Signer1.address], 2),
      ).to.be.revertedWithCustomError(MultiSig, "NotEnoughSigners");
    });

    it("should revert if Threshold input is incorrect", async function () {
      const MultiSig = await ethers.getContractFactory("multisig");
      await expect(
        MultiSig.deploy([Signer1.address, Signer2.address, Signer3.address], 1),
      ).to.be.revertedWithCustomError(MultiSig, "InvalidThreshold");
      await expect(
        MultiSig.deploy([Signer1.address, Signer2.address, Signer3.address], 4),
      ).to.be.revertedWithCustomError(MultiSig, "InvalidThreshold");
    });

    it("should mark Signers as true", async function () {
      expect(await multiSig.isSigner(Signer1.address)).to.equal(true);
      expect(await multiSig.isSigner(Signer2.address)).to.equal(true);
      expect(await multiSig.isSigner(Signer3.address)).to.equal(true);
    });

    it("should set the correct threshold", async function () {
      expect(await multiSig.Threshold()).to.equal(2);
    });

    it("should not mark non signers as true", async function () {
      expect(await multiSig.isSigner(Account1.address)).to.equal(false);
    });
  });

  // Submit Tests

  describe("Submit", async function () {
    it("should revert if Transaction Type is incorrect", async function () {
      await expect(
        multiSig
          .connect(Signer1)
          .Submit(
            Account1.address,
            ethers.ZeroAddress,
            ethers.parseEther("5"),
            0,
          ),
      ).to.be.revertedWithCustomError(multiSig, "InvalidTransactionType");
    });

    describe("ETH Transaction", async function () {
      it("should revert if receiver address is incorrect", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .Submit(
              ethers.ZeroAddress,
              ethers.ZeroAddress,
              ethers.parseEther("5"),
              1,
            ),
        ).to.be.revertedWithCustomError(multiSig, "InvalidAddress");
      });

      it("should revert if token address is not zero", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .Submit(Account1.address, token.target, ethers.parseEther("5"), 1),
        ).to.be.revertedWithCustomError(multiSig, "TokenNotRequired");
      });

      it("should revert if amount is 0", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .Submit(Account1.address, ethers.ZeroAddress, 0, 1),
        ).to.be.revertedWithCustomError(multiSig, "EmptyTransaction");
      });

      it("should register vote of Signer on submit", async function () {
        await multiSig
          .connect(Signer1)
          .Submit(
            Account1.address,
            ethers.ZeroAddress,
            ethers.parseEther("5"),
            1,
          );
        expect(await multiSig.hasConfirmed(1, Signer1.address)).to.equal(true);
      });

      it("should not register vote of non signer on submit", async function () {
        await multiSig
          .connect(Account1)
          .Submit(
            Account2.address,
            ethers.ZeroAddress,
            ethers.parseEther("5"),
            1,
          );
        expect(await multiSig.hasConfirmed(1, Account1.address)).to.equal(
          false,
        );
      });
    });

    describe("ERC20 Transaction", async function () {
      it("should revert if receiver address is incorrect", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .Submit(
              ethers.ZeroAddress,
              token.target,
              ethers.parseEther("5"),
              2,
            ),
        ).to.be.revertedWithCustomError(multiSig, "InvalidAddress");
      });

      it("should revert if token address is zero", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .Submit(
              Account1.address,
              ethers.ZeroAddress,
              ethers.parseEther("5"),
              2,
            ),
        ).to.be.revertedWithCustomError(multiSig, "UnknownTokenAddress");
      });

      it("should revert if amount is 0", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .Submit(Account1.address, token.target, 0, 2),
        ).to.be.revertedWithCustomError(multiSig, "EmptyTransaction");
      });

      it("should register vote of Signer on submit", async function () {
        await multiSig
          .connect(Signer1)
          .Submit(Account1.address, token.target, ethers.parseEther("5"), 2);
        expect(await multiSig.hasConfirmed(1, Signer1.address)).to.equal(true);
      });
    });

    describe("ADD_SIGNER Transaction", async function () {
      it("should revert if input is not zero", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .Submit(Account1.address, ethers.ZeroAddress, 1, 3),
        ).to.be.revertedWithCustomError(multiSig, "InputNotRequired");
      });

      it("should revert if address is already a signer", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .Submit(Signer2.address, ethers.ZeroAddress, 0, 3),
        ).to.be.revertedWithCustomError(multiSig, "ExistingSigner");
      });

      it("should revert if token address is not zero", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .Submit(Account1.address, token.target, 0, 3),
        ).to.be.revertedWithCustomError(multiSig, "TokenNotRequired");
      });
    });

    describe("REMOVE_SIGNER Transaction", async function () {
      it("should revert if input is not zero", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .Submit(Signer2.address, ethers.ZeroAddress, 1, 4),
        ).to.be.revertedWithCustomError(multiSig, "InputNotRequired");
      });

      it("should revert if address is not a signer", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .Submit(Account1.address, ethers.ZeroAddress, 0, 4),
        )
          .to.be.revertedWithCustomError(multiSig, "NotSigner")
          .withArgs(Signer1.address);
      });
    });

    describe("THRESHOLD Transaction", async function () {
      it("should revert if address is not zero", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .Submit(Account1.address, ethers.ZeroAddress, 2, 5),
        ).to.be.revertedWithCustomError(multiSig, "AddressNotRequired");
      });

      it("should revert if input is 0", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .Submit(ethers.ZeroAddress, ethers.ZeroAddress, 0, 5),
        ).to.be.revertedWithCustomError(multiSig, "InvalidThreshold");
      });
    });
  });

  // Confirm Tests

  describe("Confirm", async function () {
    beforeEach(async function () {
      await multiSig
        .connect(Signer1)
        .Submit(
          Account1.address,
          ethers.ZeroAddress,
          ethers.parseEther("5"),
          1,
        );
    });

    it("should revert if non signer tries to confirm", async function () {
      await expect(multiSig.connect(Account1).confirm(1))
        .to.be.revertedWithCustomError(multiSig, "NotSigner")
        .withArgs(Account1.address);
    });

    it("should revert if transaction id is invalid", async function () {
      await expect(
        multiSig.connect(Signer2).confirm(99),
      ).to.be.revertedWithCustomError(multiSig, "InvalidId");
    });

    it("should revert if signer already confirmed", async function () {
      await multiSig.connect(Signer2).confirm(1);
      await expect(
        multiSig.connect(Signer2).confirm(1),
      ).to.be.revertedWithCustomError(multiSig, "AlreadyConfirmed");
    });

    it("should increase approvals after confirm", async function () {
      await multiSig.connect(Signer2).confirm(1);
      const tx = await multiSig.Transactions(1);
      expect(tx.approvals).to.equal(2);
    });
  });

  // Execute Tests

  describe("Execute", async function () {
    it("should revert if transaction id is invalid", async function () {
      await expect(multiSig.execute(99)).to.be.revertedWithCustomError(
        multiSig,
        "InvalidId",
      );
    });

    it("should revert if threshold is not met", async function () {
      await multiSig
        .connect(Signer1)
        .Submit(
          Account1.address,
          ethers.ZeroAddress,
          ethers.parseEther("5"),
          1,
        );
      await expect(multiSig.execute(1)).to.be.revertedWithCustomError(
        multiSig,
        "ThresholdNotMet",
      );
    });

    describe("ETH Transaction", async function () {
      beforeEach(async function () {
        await multiSig
          .connect(Signer1)
          .Submit(
            Account1.address,
            ethers.ZeroAddress,
            ethers.parseEther("5"),
            1,
          );
        await multiSig.connect(Signer2).confirm(1);

        await Signer1.sendTransaction({
          to: multiSig.target,
          value: ethers.parseEther("10"),
        });
      });

      it("should execute ETH transaction successfully", async function () {
        const balanceBefore = await ethers.provider.getBalance(
          Account1.address,
        );
        await multiSig.execute(1);
        const balanceAfter = await ethers.provider.getBalance(Account1.address);
        expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("5"));
      });

      it("should mark transaction as executed", async function () {
        await multiSig.execute(1);
        const tx = await multiSig.Transactions(1);
        expect(tx._state).to.equal(2); // States.EXECUTED
      });

      it("should revert if already executed", async function () {
        await multiSig.execute(1);
        await expect(multiSig.execute(1)).to.be.revertedWithCustomError(
          multiSig,
          "InvalidId",
        );
      });

      it("should revert if insufficient ETH balance", async function () {
        await multiSig
          .connect(Signer1)
          .Submit(
            Account1.address,
            ethers.ZeroAddress,
            ethers.parseEther("100"),
            1,
          );
        await multiSig.connect(Signer2).confirm(2);
        await expect(multiSig.execute(2)).to.be.revertedWithCustomError(
          multiSig,
          "InsufficientFunds",
        );
      });
    });

    describe("ERC20 Transaction", async function () {
      beforeEach(async function () {
        await multiSig
          .connect(Signer1)
          .Submit(Account1.address, token.target, ethers.parseEther("100"), 2);
        await multiSig.connect(Signer2).confirm(1);
      });

      it("should execute ERC20 transaction successfully", async function () {
        await multiSig.execute(1);
        expect(await token.balanceOf(Account1.address)).to.equal(
          ethers.parseEther("100"),
        );
      });

      it("should mark transaction as executed", async function () {
        await multiSig.execute(1);
        const tx = await multiSig.Transactions(1);
        expect(tx._state).to.equal(2); // States.EXECUTED
      });
    });

    describe("ADD_SIGNER Transaction", async function () {
      beforeEach(async function () {
        await multiSig
          .connect(Signer1)
          .Submit(Account1.address, ethers.ZeroAddress, 0, 3);
        await multiSig.connect(Signer2).confirm(1);
      });

      it("should add signer successfully", async function () {
        await multiSig.execute(1);
        expect(await multiSig.isSigner(Account1.address)).to.equal(true);
      });

      it("should mark transaction as executed", async function () {
        await multiSig.execute(1);
        const tx = await multiSig.Transactions(1);
        expect(tx._state).to.equal(2);
      });
    });

    describe("REMOVE_SIGNER Transaction", async function () {
      beforeEach(async function () {
        await multiSig
          .connect(Signer1)
          .Submit(Signer3.address, ethers.ZeroAddress, 0, 4);
        await multiSig.connect(Signer2).confirm(1);
      });

      it("should remove signer successfully", async function () {
        await multiSig.execute(1);
        expect(await multiSig.isSigner(Signer3.address)).to.equal(false);
      });

      it("should mark transaction as executed", async function () {
        await multiSig.execute(1);
        const tx = await multiSig.Transactions(1);
        expect(tx._state).to.equal(2);
      });
    });

    describe("THRESHOLD Transaction", async function () {
      beforeEach(async function () {
        await multiSig
          .connect(Signer1)
          .Submit(ethers.ZeroAddress, ethers.ZeroAddress, 3, 5);
        await multiSig.connect(Signer2).confirm(1);
      });

      it("should update threshold successfully", async function () {
        await multiSig.execute(1);
        expect(await multiSig.Threshold()).to.equal(3);
      });

      it("should mark transaction as executed", async function () {
        await multiSig.execute(1);
        const tx = await multiSig.Transactions(1);
        expect(tx._state).to.equal(2);
      });
    });
  });
});
