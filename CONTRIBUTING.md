# Contributing to w3-kit/contracts

Thanks for your interest in contributing smart contracts!

## How to contribute

1. Fork the repo
2. Create a branch (`git checkout -b my-contract`)
3. Add your contract with tests
4. Commit and push
5. Open a pull request

## EVM contracts (Solidity + Foundry)

Each contract lives in `evm/`:

```
evm/your-contract/
├── src/           # Solidity source
├── test/          # Foundry tests
├── .learn.md      # Educational explanation
└── foundry.toml   # Foundry config
```

### Requirements
- Use OpenZeppelin where applicable
- 100% test coverage for critical paths
- Include a `.learn.md` with security considerations
- Follow Foundry conventions

## Solana programs (Anchor)

Each program lives in `solana/`:

```
solana/your-program/
├── programs/      # Anchor program
├── tests/         # Tests
└── .learn.md      # Educational explanation
```

## Local development

### EVM (Hardhat)

```bash
cd evm/token-erc20
npm install
npx hardhat compile
npx hardhat test
```

### EVM (Foundry)

```bash
# Install Foundry: https://getfoundry.sh
curl -L https://foundry.paradigm.xyz | bash
foundryup

cd evm/your-contract
forge build
forge test -vvv
```

Each template is self-contained — `cd` into the template directory and follow its toolchain.

## Guidelines

- Security first — document all assumptions and attack vectors
- Keep contracts minimal and auditable
- Every contract needs a `.learn.md`

Check [open issues](https://github.com/w3-kit/contracts/issues) for ideas.
