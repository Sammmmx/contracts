# EVM Template Standard

Every EVM contract template in this repo must follow this standard to ensure consistency, quality, and copy-paste usability.

## Directory Structure

```
evm/<template-name>/
├── src/                    # Solidity contracts
├── test/                   # Hardhat test suite
├── ignition/modules/       # Deploy scripts (Hardhat Ignition)
├── hardhat.config.ts
├── package.json
├── tsconfig.json
├── .gitignore
├── .env.example
└── .learn.md
```

## Naming

- Directory names: lowercase kebab-case (e.g. `token-erc20`, `token-erc721`, `staking`)
- Contract files: PascalCase matching the contract name (e.g. `ERC20.sol`)
- Test files: contract name + `Test` suffix (e.g. `ERC20Test.ts`)

## Solidity

- **Pragma**: pin to exact version, no caret (e.g. `pragma solidity 0.8.26;`)
- **License**: SPDX-License-Identifier: MIT
- **Custom errors**: use custom errors instead of `require` strings — cheaper gas, more informative
- **Events**: emit dedicated events for state-changing operations beyond inherited ones
- **Constructor validation**: validate all immutable/critical parameters (e.g. revert on zero address, zero supply)
- **Newline at EOF**: all files must end with a newline

## Hardhat Config

- **Optimizer**: always enabled
  ```typescript
  optimizer: { enabled: true, runs: 200 }
  ```
- **No hardcoded secrets**: use `process.env.*` only, no fallback values for keys or URLs
- **Networks**: only include networks that require env vars; leave the config clean for local testing by default

## package.json

- **name**: must match the template directory name (e.g. `"token-erc20"`)
- **All dependencies listed**: if the contract imports it, it must be in `dependencies` or `devDependencies`
- **Include a lockfile**: commit `package-lock.json` for reproducible installs

## .env.example

Every template must include a `.env.example` with all required environment variables (no real values):

```
PRIVATE_KEY=
ALCHEMY_URL=
ETHERSCAN_API_KEY=
```

## Tests

- **Framework**: Hardhat + Chai + Ethers
- **Coverage**: test all public/external functions, access control, edge cases, and revert conditions
- **Required test categories**:
  - Deployment / constructor parameters
  - Core functionality (happy path)
  - Access control (owner-only, unauthorized)
  - Edge cases (zero values, max values, boundary conditions)
  - Revert conditions with correct error names
- **Test all included features**: if a feature is inherited (e.g. ERC20Permit), it must have at least one test

## .learn.md

Every template must include a `.learn.md` that covers:

- What the standard/pattern is and why it exists
- How this template implements it
- Security considerations specific to this contract
- Deployment instructions
- What the tests cover

Write for someone who knows basic Solidity but is new to the specific standard.

## Self-Contained Rule

Every template must work as a standalone project when copied to a new directory. No dependencies on parent folders, shared configs, or workspace roots. A user should be able to:

```bash
cp -r evm/token-erc20 ~/my-project
cd ~/my-project
npm install
npx hardhat test
```
