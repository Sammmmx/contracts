# ERC-1155 Multi-Token

A production-ready ERC-1155 multi-token contract built with Solidity and Hardhat.

## What's inside

- ERC-1155 with Metadata URI extension
- Role-based access control via OpenZeppelin AccessControl
- Configurable minter and URI setter roles
- Batch minting support
- Hardhat test suite (60 tests)

## Setup

```bash
npm install
```

## Test

```bash
npx hardhat test
```

## Deploy

```bash
npx hardhat ignition deploy ignition/modules/ERC1155Deploy.ts --network sepolia
```

## Learn

See [.learn.md](./.learn.md) for a breakdown of the ERC-1155 standard, multi-token patterns, and access control design.

## Stack

Solidity | Hardhat | OpenZeppelin | Ethers.js | TypeScript
