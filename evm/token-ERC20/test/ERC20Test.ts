import { expect } from "chai";
import { ethers } from "hardhat";
import { TokenERC20 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("TokenERC20", function () {
  let token: TokenERC20;
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  const NAME = "MyToken";
  const SYMBOL = "MTK";
  const MAX_SUPPLY = ethers.parseEther("1000000"); // 1 million tokens

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("TokenERC20");
    token = await Token.deploy(owner.address, NAME, SYMBOL, MAX_SUPPLY);
  });

  // Deployment Tests

  describe("Deployment", function () {
    it("should revert if max supply is set as 0", async function () {
      const Token = await ethers.getContractFactory("TokenERC20");
      await expect(
        Token.deploy(owner.address, NAME, SYMBOL, 0),
      ).to.be.revertedWith("Max Supply must be greater than 0");
    });
    it("should set the correct name", async function () {
      expect(await token.name()).to.equal(NAME);
    });

    it("should set the correct symbol", async function () {
      expect(await token.symbol()).to.equal(SYMBOL);
    });

    it("should set the correct owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("should set the correct max supply", async function () {
      expect(await token.maxSupply()).to.equal(MAX_SUPPLY);
    });

    it("should start with zero total supply", async function () {
      expect(await token.totalSupply()).to.equal(0);
    });

    it("should have 18 decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });
  });

  // Mint Tests
  describe("Mint", function () {
    it("should allow owner to mint tokens", async function () {
      const amount = ethers.parseEther("100");
      await token.mint(alice.address, amount);
      expect(await token.balanceOf(alice.address)).to.equal(amount);
    });

    it("should increase total supply after mint", async function () {
      const amount = ethers.parseEther("100");
      await token.mint(alice.address, amount);
      expect(await token.totalSupply()).to.equal(amount);
    });

    it("should revert if non owner tries to mint", async function () {
      const amount = ethers.parseEther("100");
      await expect(
        token.connect(alice).mint(alice.address, amount),
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("should revert if minting exceeds max supply", async function () {
      const overMax = MAX_SUPPLY + ethers.parseEther("1");
      await expect(
        token.mint(alice.address, overMax),
      ).to.be.revertedWithCustomError(token, "ExceedsMaxSupply");
    });

    it("should allow minting up to exactly max supply", async function () {
      await token.mint(alice.address, MAX_SUPPLY);
      expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
    });

    it("should revert if minting would exceed max supply across multiple mints", async function () {
      await token.mint(alice.address, ethers.parseEther("999999"));
      await expect(
        token.mint(alice.address, ethers.parseEther("2")),
      ).to.be.revertedWithCustomError(token, "ExceedsMaxSupply");
    });

    it("should revert mint after renounceOwnership", async function () {
      await token.renounceOwnership();
      await expect(
        token.mint(alice.address, ethers.parseEther("1")),
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("should emit Mint event on successful mint", async function () {
      const amount = ethers.parseEther("100");
      await expect(token.mint(alice.address, amount))
        .to.emit(token, "Mint")
        .withArgs(alice.address, amount);
    });
  });

  // Burn Tests

  describe("Burn", function () {
    beforeEach(async function () {
      await token.mint(alice.address, ethers.parseEther("100"));
    });

    it("should allow token holder to burn their tokens", async function () {
      await token.connect(alice).burn(ethers.parseEther("50"));
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther("50"),
      );
    });

    it("should decrease total supply after burn", async function () {
      await token.connect(alice).burn(ethers.parseEther("50"));
      expect(await token.totalSupply()).to.equal(ethers.parseEther("50"));
    });

    it("should revert if burning more than balance", async function () {
      await expect(
        token.connect(alice).burn(ethers.parseEther("200")),
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("should allow burnFrom with approval", async function () {
      await token.connect(alice).approve(bob.address, ethers.parseEther("50"));
      await token.connect(bob).burnFrom(alice.address, ethers.parseEther("50"));
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther("50"),
      );
    });

    it("should revert burnFrom without approval", async function () {
      await expect(
        token.connect(bob).burnFrom(alice.address, ethers.parseEther("50")),
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });
  });

  // Pause Tests

  describe("Pause", function () {
    beforeEach(async function () {
      await token.mint(alice.address, ethers.parseEther("100"));
    });

    it("should allow owner to pause", async function () {
      await token.pause();
      expect(await token.paused()).to.equal(true);
    });

    it("should allow owner to unpause", async function () {
      await token.pause();
      await token.unpause();
      expect(await token.paused()).to.equal(false);
    });

    it("should revert if non owner tries to pause", async function () {
      await expect(token.connect(alice).pause()).to.be.revertedWithCustomError(
        token,
        "OwnableUnauthorizedAccount",
      );
    });

    it("should revert if non owner tries to unpause", async function () {
      await token.pause();
      await expect(
        token.connect(alice).unpause(),
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("should block transfers when paused", async function () {
      await token.pause();
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther("10")),
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("should block minting when paused", async function () {
      await token.pause();
      await expect(
        token.mint(alice.address, ethers.parseEther("10")),
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("should block burning when paused", async function () {
      await token.pause();
      await expect(
        token.connect(alice).burn(ethers.parseEther("10")),
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("should allow transfers after unpause", async function () {
      await token.pause();
      await token.unpause();
      await token.connect(alice).transfer(bob.address, ethers.parseEther("10"));
      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther("10"),
      );
    });
  });

  // Transfer Tests
  describe("Transfer", function () {
    beforeEach(async function () {
      await token.mint(alice.address, ethers.parseEther("100"));
    });

    it("should transfer tokens between accounts", async function () {
      await token.connect(alice).transfer(bob.address, ethers.parseEther("50"));
      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther("50"),
      );
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther("50"),
      );
    });

    it("should revert if transfer exceeds balance", async function () {
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther("200")),
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("should revert if transferring to zero address", async function () {
      await expect(
        token
          .connect(alice)
          .transfer(ethers.ZeroAddress, ethers.parseEther("10")),
      ).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
    });
  });

  // Approve and Transform Tests
  describe("Approve and TransferFrom", function () {
    beforeEach(async function () {
      await token.mint(alice.address, ethers.parseEther("100"));
    });

    it("should allow approval and transferFrom", async function () {
      await token.connect(alice).approve(bob.address, ethers.parseEther("50"));
      await token
        .connect(bob)
        .transferFrom(alice.address, bob.address, ethers.parseEther("50"));
      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther("50"),
      );
    });

    it("should revert transferFrom without approval", async function () {
      await expect(
        token
          .connect(bob)
          .transferFrom(alice.address, bob.address, ethers.parseEther("50")),
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("should decrease allowance after transferFrom", async function () {
      await token.connect(alice).approve(bob.address, ethers.parseEther("50"));
      await token
        .connect(bob)
        .transferFrom(alice.address, bob.address, ethers.parseEther("30"));
      expect(await token.allowance(alice.address, bob.address)).to.equal(
        ethers.parseEther("20"),
      );
    });
  });

  // Ownership Tests
  describe("Ownership", function () {
    it("should allow owner to transfer ownership", async function () {
      await token.transferOwnership(alice.address);
      expect(await token.owner()).to.equal(alice.address);
    });

    it("should revert if non owner tries to transfer ownership", async function () {
      await expect(
        token.connect(alice).transferOwnership(bob.address),
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to renounce ownership", async function () {
      await token.renounceOwnership();
      expect(await token.owner()).to.equal(ethers.ZeroAddress);
    });

    it("should revert transferOwnership to zero address", async function () {
      await expect(
        token.transferOwnership(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(token, "OwnableInvalidOwner");
    });
  });

  describe("Permit (EIP-2612)", function () {
    it("should allow an approval via a signed permit", async function () {
      const amount = ethers.parseEther("50");
      const nonce = await token.nonces(alice.address);
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const domain = {
        name: await token.name(),
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await token.getAddress(),
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const sig = await alice.signTypedData(domain, types, {
        owner: alice.address,
        spender: bob.address,
        value: amount,
        nonce,
        deadline,
      });
      const { v, r, s } = ethers.Signature.from(sig);

      await token
        .connect(bob)
        .permit(alice.address, bob.address, amount, deadline, v, r, s);
      expect(await token.allowance(alice.address, bob.address)).to.equal(
        amount,
      );
    });

    it("should revert permit with an expired deadline", async function () {
      const amount = ethers.parseEther("50");
      const nonce = await token.nonces(alice.address);
      const deadline = Math.floor(Date.now() / 1000) - 1;

      const domain = {
        name: await token.name(),
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await token.getAddress(),
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const sig = await alice.signTypedData(domain, types, {
        owner: alice.address,
        spender: bob.address,
        value: amount,
        nonce,
        deadline,
      });
      const { v, r, s } = ethers.Signature.from(sig);

      await expect(
        token
          .connect(bob)
          .permit(alice.address, bob.address, amount, deadline, v, r, s),
      ).to.be.revertedWithCustomError(token, "ERC2612ExpiredSignature");
    });
  });
});
