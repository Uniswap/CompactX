# CompactX

CompactX is a proof-of-concept, React-based web interface for performing cross-chain swaps. It is built using [The Compact](https://github.com/Uniswap/the-compact).

## Related Services

CompactX relies on several key services:

- [Tribunal](https://github.com/Uniswap/Tribunal) - Settlement and cross-chain messaging (this implementation utilizes Hyperlane)
- [Calibrator](https://github.com/Uniswap/Calibrator) - Intent parameterization service
- [Smallocator](https://github.com/Uniswap/Smallocator) - Resource lock allocation service
- [Fillanthropist](https://github.com/Uniswap/Fillanthropist) - Manual filler / solver (meant as an illustrative example of how settlement works)

## Installation

```bash
# Install dependencies
npm install
```

## Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Watch mode
npm run test:watch

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## License

MIT License
