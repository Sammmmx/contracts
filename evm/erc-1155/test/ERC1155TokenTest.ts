import { expect } from "chai";
import { ethers } from "hardhat";
import { ERC1155Token } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ERC1155Token", function () {
  let erc1155: ERC1155Token;
  let deployer: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let uriSetter: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  const TOKEN_ID = 1n;
  const TOKEN_AMOUNT = 100n;
  const TOKEN_URI = "ipfs://QmYourHash/metadata.json";
  const EMPTY_DATA = "0x";

  beforeEach(async function () {
    [deployer, minter, uriSetter, user] = await ethers.getSigners();

    const ERC1155Factory = await ethers.getContractFactory("ERC1155Token");
    erc1155 = await ERC1155Factory.deploy(
      deployer.address,
      minter.address,
      uriSetter.address,
    );
  });

  describe("Deployment", function () {
    it("should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const adminRole = await erc1155.DEFAULT_ADMIN_ROLE();
      expect(await erc1155.hasRole(adminRole, deployer.address)).to.be.true;
    });

    it("should grant MINTER_ROLE to minter", async function () {
      const minterRole = await erc1155.MINTER_ROLE();
      expect(await erc1155.hasRole(minterRole, minter.address)).to.be.true;
    });

    it("should grant URI_SETTER_ROLE to uriSetter", async function () {
      const uriSetterRole = await erc1155.URI_SETTER_ROLE();
      expect(await erc1155.hasRole(uriSetterRole, uriSetter.address)).to.be
        .true;
    });

    describe("Constructor Parameters", function () {
      it("should revert if ROLES have similar addresses", async function () {
        const ERC1155Factory = await ethers.getContractFactory("ERC1155Token");
        await expect(
          ERC1155Factory.deploy(
            deployer.address,
            deployer.address,
            deployer.address,
          ),
        ).to.be.revertedWithCustomError(erc1155, "RolesNotSeparated");
      });

      it("should revert if address is invalid", async function () {
        const ERC1155Factory = await ethers.getContractFactory("ERC1155Token");
        await expect(
          ERC1155Factory.deploy(
            ethers.ZeroAddress,
            minter.address,
            uriSetter.address,
          ),
        ).to.be.revertedWithCustomError(erc1155, "ZeroAddress");
      });
    });

    it("should deploy with an empty base URI", async function () {
      expect(await erc1155.uri(TOKEN_ID)).to.equal("");
    });
  });

  describe("setURI", function () {
    describe("Happy Path", function () {
      it("should allow uriSetter to set a valid URI", async function () {
        await erc1155.connect(uriSetter).setURI(TOKEN_URI);
        expect(await erc1155.uri(TOKEN_ID)).to.equal(TOKEN_URI);
      });

      it("should allow updating URI multiple times", async function () {
        const NEW_URI = "ipfs://QmNewHash/metadata.json";
        await erc1155.connect(uriSetter).setURI(TOKEN_URI);
        await erc1155.connect(uriSetter).setURI(NEW_URI);
        expect(await erc1155.uri(TOKEN_ID)).to.equal(NEW_URI);
      });

      it("should allow URIs with different protocols", async function () {
        const HTTPS_URI = "https://metadata.server.com/nft/{id}.json";
        await erc1155.connect(uriSetter).setURI(HTTPS_URI);
        expect(await erc1155.uri(TOKEN_ID)).to.equal(HTTPS_URI);
      });
    });

    describe("Revert Conditions", function () {
      it("should revert with EmptyURI if empty string is passed", async function () {
        await expect(
          erc1155.connect(uriSetter).setURI(""),
        ).to.be.revertedWithCustomError(erc1155, "EmptyURI");
      });

      it("should revert if called by minter", async function () {
        await expect(erc1155.connect(minter).setURI(TOKEN_URI))
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(minter.address, await erc1155.URI_SETTER_ROLE());
      });

      it("should revert if called by unauthorized user", async function () {
        await expect(erc1155.connect(user).setURI(TOKEN_URI))
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(user.address, await erc1155.URI_SETTER_ROLE());
      });

      it("should revert if called by deployer", async function () {
        await expect(erc1155.connect(deployer).setURI(TOKEN_URI))
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(deployer.address, await erc1155.URI_SETTER_ROLE());
      });
    });
  });

  describe("mint", function () {
    describe("Happy Path", function () {
      it("should allow minter to mint tokens", async function () {
        await erc1155
          .connect(minter)
          .mint(user.address, TOKEN_ID, TOKEN_AMOUNT, EMPTY_DATA);
        expect(await erc1155.balanceOf(user.address, TOKEN_ID)).to.equal(
          TOKEN_AMOUNT,
        );
      });

      it("should emit TransferSingle event on mint", async function () {
        await expect(
          erc1155
            .connect(minter)
            .mint(user.address, TOKEN_ID, TOKEN_AMOUNT, EMPTY_DATA),
        )
          .to.emit(erc1155, "TransferSingle")
          .withArgs(
            minter.address,
            ethers.ZeroAddress,
            user.address,
            TOKEN_ID,
            TOKEN_AMOUNT,
          );
      });

      it("should allow minting different token IDs to same address", async function () {
        await erc1155
          .connect(minter)
          .mint(user.address, TOKEN_ID, TOKEN_AMOUNT, EMPTY_DATA);
        await erc1155
          .connect(minter)
          .mint(user.address, 2n, TOKEN_AMOUNT, EMPTY_DATA);

        expect(await erc1155.balanceOf(user.address, TOKEN_ID)).to.equal(
          TOKEN_AMOUNT,
        );
        expect(await erc1155.balanceOf(user.address, 2n)).to.equal(
          TOKEN_AMOUNT,
        );
      });

      it("should allow minting same token ID to different addresses", async function () {
        await erc1155
          .connect(minter)
          .mint(user.address, TOKEN_ID, TOKEN_AMOUNT, EMPTY_DATA);
        await erc1155
          .connect(minter)
          .mint(deployer.address, TOKEN_ID, TOKEN_AMOUNT, EMPTY_DATA);

        expect(await erc1155.balanceOf(user.address, TOKEN_ID)).to.equal(
          TOKEN_AMOUNT,
        );
        expect(await erc1155.balanceOf(deployer.address, TOKEN_ID)).to.equal(
          TOKEN_AMOUNT,
        );
      });

      it("should accumulate balance on multiple mints of same token ID", async function () {
        await erc1155
          .connect(minter)
          .mint(user.address, TOKEN_ID, TOKEN_AMOUNT, EMPTY_DATA);
        await erc1155
          .connect(minter)
          .mint(user.address, TOKEN_ID, TOKEN_AMOUNT, EMPTY_DATA);

        expect(await erc1155.balanceOf(user.address, TOKEN_ID)).to.equal(
          TOKEN_AMOUNT * 2n,
        );
      });
    });

    describe("Edge Cases", function () {
      it("should allow minting zero amount", async function () {
        await expect(
          erc1155.connect(minter).mint(user.address, TOKEN_ID, 0n, EMPTY_DATA),
        ).to.not.be.reverted;
        expect(await erc1155.balanceOf(user.address, TOKEN_ID)).to.equal(0n);
      });

      it("should allow minting with large token ID", async function () {
        const LARGE_ID = ethers.MaxUint256;
        await erc1155
          .connect(minter)
          .mint(user.address, LARGE_ID, TOKEN_AMOUNT, EMPTY_DATA);
        expect(await erc1155.balanceOf(user.address, LARGE_ID)).to.equal(
          TOKEN_AMOUNT,
        );
      });

      it("should allow minting with large token amount", async function () {
        const LARGE_AMOUNT = ethers.MaxUint256;
        await erc1155
          .connect(minter)
          .mint(user.address, TOKEN_ID, LARGE_AMOUNT, EMPTY_DATA);
        expect(await erc1155.balanceOf(user.address, TOKEN_ID)).to.equal(
          LARGE_AMOUNT,
        );
      });
    });

    describe("Revert Conditions", function () {
      it("should revert if called by unauthorized user", async function () {
        await expect(
          erc1155
            .connect(user)
            .mint(user.address, TOKEN_ID, TOKEN_AMOUNT, EMPTY_DATA),
        )
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(user.address, await erc1155.MINTER_ROLE());
      });

      it("should revert if called by uriSetter", async function () {
        await expect(
          erc1155
            .connect(uriSetter)
            .mint(user.address, TOKEN_ID, TOKEN_AMOUNT, EMPTY_DATA),
        )
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(uriSetter.address, await erc1155.MINTER_ROLE());
      });

      it("should revert if called by deployer", async function () {
        await expect(
          erc1155
            .connect(deployer)
            .mint(user.address, TOKEN_ID, TOKEN_AMOUNT, EMPTY_DATA),
        )
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(deployer.address, await erc1155.MINTER_ROLE());
      });

      it("should revert if minting to zero address", async function () {
        await expect(
          erc1155
            .connect(minter)
            .mint(ethers.ZeroAddress, TOKEN_ID, TOKEN_AMOUNT, EMPTY_DATA),
        ).to.be.revertedWithCustomError(erc1155, "ERC1155InvalidReceiver");
      });
    });
  });

  describe("mintBatch", function () {
    const TOKEN_IDS = [1n, 2n, 3n];
    const TOKEN_AMOUNTS = [100n, 200n, 300n];

    describe("Happy Path", function () {
      it("should allow minter to batch mint tokens", async function () {
        await erc1155
          .connect(minter)
          .mintBatch(user.address, TOKEN_IDS, TOKEN_AMOUNTS, EMPTY_DATA);

        expect(await erc1155.balanceOf(user.address, 1n)).to.equal(100n);
        expect(await erc1155.balanceOf(user.address, 2n)).to.equal(200n);
        expect(await erc1155.balanceOf(user.address, 3n)).to.equal(300n);
      });

      it("should emit TransferBatch event on mintBatch", async function () {
        await expect(
          erc1155
            .connect(minter)
            .mintBatch(user.address, TOKEN_IDS, TOKEN_AMOUNTS, EMPTY_DATA),
        )
          .to.emit(erc1155, "TransferBatch")
          .withArgs(
            minter.address,
            ethers.ZeroAddress,
            user.address,
            TOKEN_IDS,
            TOKEN_AMOUNTS,
          );
      });

      it("should accumulate balance on multiple batch mints of same token IDs", async function () {
        await erc1155
          .connect(minter)
          .mintBatch(user.address, TOKEN_IDS, TOKEN_AMOUNTS, EMPTY_DATA);
        await erc1155
          .connect(minter)
          .mintBatch(user.address, TOKEN_IDS, TOKEN_AMOUNTS, EMPTY_DATA);

        expect(await erc1155.balanceOf(user.address, 1n)).to.equal(200n);
        expect(await erc1155.balanceOf(user.address, 2n)).to.equal(400n);
        expect(await erc1155.balanceOf(user.address, 3n)).to.equal(600n);
      });

      it("should allow batch minting to multiple addresses separately", async function () {
        await erc1155
          .connect(minter)
          .mintBatch(user.address, TOKEN_IDS, TOKEN_AMOUNTS, EMPTY_DATA);
        await erc1155
          .connect(minter)
          .mintBatch(deployer.address, TOKEN_IDS, TOKEN_AMOUNTS, EMPTY_DATA);

        expect(await erc1155.balanceOf(user.address, 1n)).to.equal(100n);
        expect(await erc1155.balanceOf(deployer.address, 1n)).to.equal(100n);
      });

      it("should allow batch minting with a single token ID and amount", async function () {
        await erc1155
          .connect(minter)
          .mintBatch(user.address, [TOKEN_ID], [TOKEN_AMOUNT], EMPTY_DATA);
        expect(await erc1155.balanceOf(user.address, TOKEN_ID)).to.equal(
          TOKEN_AMOUNT,
        );
      });
    });

    describe("Edge Cases", function () {
      it("should allow batch minting with zero amounts", async function () {
        await expect(
          erc1155
            .connect(minter)
            .mintBatch(user.address, TOKEN_IDS, [0n, 0n, 0n], EMPTY_DATA),
        ).to.not.be.reverted;

        expect(await erc1155.balanceOf(user.address, 1n)).to.equal(0n);
        expect(await erc1155.balanceOf(user.address, 2n)).to.equal(0n);
        expect(await erc1155.balanceOf(user.address, 3n)).to.equal(0n);
      });

      it("should allow batch minting with empty arrays", async function () {
        await expect(
          erc1155.connect(minter).mintBatch(user.address, [], [], EMPTY_DATA),
        ).to.not.be.reverted;
      });

      it("should allow batch minting with large token IDs and amounts", async function () {
        const LARGE_IDS = [ethers.MaxUint256, ethers.MaxUint256 - 1n];
        const LARGE_AMOUNTS = [ethers.MaxUint256, ethers.MaxUint256];

        await erc1155
          .connect(minter)
          .mintBatch(user.address, LARGE_IDS, LARGE_AMOUNTS, EMPTY_DATA);

        expect(
          await erc1155.balanceOf(user.address, ethers.MaxUint256),
        ).to.equal(ethers.MaxUint256);
        expect(
          await erc1155.balanceOf(user.address, ethers.MaxUint256 - 1n),
        ).to.equal(ethers.MaxUint256);
      });
    });

    describe("Revert Conditions", function () {
      it("should revert if ids and amounts arrays length mismatch", async function () {
        await expect(
          erc1155
            .connect(minter)
            .mintBatch(user.address, TOKEN_IDS, [100n, 200n], EMPTY_DATA),
        )
          .to.be.revertedWithCustomError(erc1155, "ERC1155InvalidArrayLength")
          .withArgs(TOKEN_IDS.length, 2);
      });

      it("should revert if minting to zero address", async function () {
        await expect(
          erc1155
            .connect(minter)
            .mintBatch(
              ethers.ZeroAddress,
              TOKEN_IDS,
              TOKEN_AMOUNTS,
              EMPTY_DATA,
            ),
        ).to.be.revertedWithCustomError(erc1155, "ERC1155InvalidReceiver");
      });

      it("should revert if called by unauthorized user", async function () {
        await expect(
          erc1155
            .connect(user)
            .mintBatch(user.address, TOKEN_IDS, TOKEN_AMOUNTS, EMPTY_DATA),
        )
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(user.address, await erc1155.MINTER_ROLE());
      });

      it("should revert if called by uriSetter", async function () {
        await expect(
          erc1155
            .connect(uriSetter)
            .mintBatch(user.address, TOKEN_IDS, TOKEN_AMOUNTS, EMPTY_DATA),
        )
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(uriSetter.address, await erc1155.MINTER_ROLE());
      });

      it("should revert if called by deployer", async function () {
        await expect(
          erc1155
            .connect(deployer)
            .mintBatch(user.address, TOKEN_IDS, TOKEN_AMOUNTS, EMPTY_DATA),
        )
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(deployer.address, await erc1155.MINTER_ROLE());
      });
    });
  });

  describe("AccessControl", function () {
    describe("Role Management", function () {
      it("should allow admin to grant MINTER_ROLE to a new address", async function () {
        const minterRole = await erc1155.MINTER_ROLE();
        await erc1155.connect(deployer).grantRole(minterRole, user.address);
        expect(await erc1155.hasRole(minterRole, user.address)).to.be.true;
      });

      it("should allow admin to grant URI_SETTER_ROLE to a new address", async function () {
        const uriSetterRole = await erc1155.URI_SETTER_ROLE();
        await erc1155.connect(deployer).grantRole(uriSetterRole, user.address);
        expect(await erc1155.hasRole(uriSetterRole, user.address)).to.be.true;
      });

      it("should allow admin to revoke MINTER_ROLE", async function () {
        const minterRole = await erc1155.MINTER_ROLE();
        await erc1155.connect(deployer).revokeRole(minterRole, minter.address);
        expect(await erc1155.hasRole(minterRole, minter.address)).to.be.false;
      });

      it("should allow admin to revoke URI_SETTER_ROLE", async function () {
        const uriSetterRole = await erc1155.URI_SETTER_ROLE();
        await erc1155
          .connect(deployer)
          .revokeRole(uriSetterRole, uriSetter.address);
        expect(await erc1155.hasRole(uriSetterRole, uriSetter.address)).to.be
          .false;
      });

      it("should allow a role member to renounce their own role", async function () {
        const minterRole = await erc1155.MINTER_ROLE();
        await erc1155.connect(minter).renounceRole(minterRole, minter.address);
        expect(await erc1155.hasRole(minterRole, minter.address)).to.be.false;
      });

      it("should emit RoleGranted event when granting a role", async function () {
        const minterRole = await erc1155.MINTER_ROLE();
        await expect(
          erc1155.connect(deployer).grantRole(minterRole, user.address),
        )
          .to.emit(erc1155, "RoleGranted")
          .withArgs(minterRole, user.address, deployer.address);
      });

      it("should emit RoleRevoked event when revoking a role", async function () {
        const minterRole = await erc1155.MINTER_ROLE();
        await expect(
          erc1155.connect(deployer).revokeRole(minterRole, minter.address),
        )
          .to.emit(erc1155, "RoleRevoked")
          .withArgs(minterRole, minter.address, deployer.address);
      });
    });

    describe("Role Based Access", function () {
      it("should allow newly granted minter to mint", async function () {
        const minterRole = await erc1155.MINTER_ROLE();
        await erc1155.connect(deployer).grantRole(minterRole, user.address);
        await erc1155
          .connect(user)
          .mint(user.address, TOKEN_ID, TOKEN_AMOUNT, EMPTY_DATA);
        expect(await erc1155.balanceOf(user.address, TOKEN_ID)).to.equal(
          TOKEN_AMOUNT,
        );
      });

      it("should allow newly granted uriSetter to set URI", async function () {
        const uriSetterRole = await erc1155.URI_SETTER_ROLE();
        await erc1155.connect(deployer).grantRole(uriSetterRole, user.address);
        await erc1155.connect(user).setURI(TOKEN_URI);
        expect(await erc1155.uri(TOKEN_ID)).to.equal(TOKEN_URI);
      });

      it("should prevent revoked minter from minting", async function () {
        const minterRole = await erc1155.MINTER_ROLE();
        await erc1155.connect(deployer).revokeRole(minterRole, minter.address);
        await expect(
          erc1155
            .connect(minter)
            .mint(user.address, TOKEN_ID, TOKEN_AMOUNT, EMPTY_DATA),
        )
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(minter.address, minterRole);
      });

      it("should prevent revoked uriSetter from setting URI", async function () {
        const uriSetterRole = await erc1155.URI_SETTER_ROLE();
        await erc1155
          .connect(deployer)
          .revokeRole(uriSetterRole, uriSetter.address);
        await expect(erc1155.connect(uriSetter).setURI(TOKEN_URI))
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(uriSetter.address, uriSetterRole);
      });

      it("should prevent renounced minter from minting", async function () {
        const minterRole = await erc1155.MINTER_ROLE();
        await erc1155.connect(minter).renounceRole(minterRole, minter.address);
        await expect(
          erc1155
            .connect(minter)
            .mint(user.address, TOKEN_ID, TOKEN_AMOUNT, EMPTY_DATA),
        )
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(minter.address, minterRole);
      });
    });

    describe("Revert Conditions", function () {
      it("should revert if non admin tries to grant MINTER_ROLE", async function () {
        const minterRole = await erc1155.MINTER_ROLE();
        await expect(erc1155.connect(user).grantRole(minterRole, user.address))
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(user.address, await erc1155.DEFAULT_ADMIN_ROLE());
      });

      it("should revert if non admin tries to grant URI_SETTER_ROLE", async function () {
        const uriSetterRole = await erc1155.URI_SETTER_ROLE();
        await expect(
          erc1155.connect(user).grantRole(uriSetterRole, user.address),
        )
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(user.address, await erc1155.DEFAULT_ADMIN_ROLE());
      });

      it("should revert if non admin tries to revoke a role", async function () {
        const minterRole = await erc1155.MINTER_ROLE();
        await expect(
          erc1155.connect(user).revokeRole(minterRole, minter.address),
        )
          .to.be.revertedWithCustomError(
            erc1155,
            "AccessControlUnauthorizedAccount",
          )
          .withArgs(user.address, await erc1155.DEFAULT_ADMIN_ROLE());
      });

      it("should revert if member tries to renounce role on behalf of another address", async function () {
        const minterRole = await erc1155.MINTER_ROLE();
        await expect(
          erc1155.connect(deployer).renounceRole(minterRole, minter.address),
        ).to.be.revertedWithCustomError(
          erc1155,
          "AccessControlBadConfirmation",
        );
      });
    });
  });

  describe("supportsInterface", function () {
    it("should support ERC1155 interface", async function () {
      // Interface ID for ERC1155 is 0xd9b67a26
      expect(await erc1155.supportsInterface("0xd9b67a26")).to.be.true;
    });

    it("should support ERC1155MetadataURI interface", async function () {
      // Interface ID for ERC1155MetadataURI is 0x0e89341c
      expect(await erc1155.supportsInterface("0x0e89341c")).to.be.true;
    });

    it("should support AccessControl interface", async function () {
      // Interface ID for AccessControl is 0x7965db0b
      expect(await erc1155.supportsInterface("0x7965db0b")).to.be.true;
    });

    it("should support ERC165 interface", async function () {
      // Interface ID for ERC165 is 0x01ffc9a7
      expect(await erc1155.supportsInterface("0x01ffc9a7")).to.be.true;
    });

    it("should return false for unsupported interface", async function () {
      // Randomly generated dummy interface ID
      expect(await erc1155.supportsInterface("0xffffffff")).to.be.false;
    });

    it("should return false for ERC721 interface", async function () {
      // Confirming ERC721 interface ID 0x80ac58cd is not supported
      expect(await erc1155.supportsInterface("0x80ac58cd")).to.be.false;
    });
  });
});
