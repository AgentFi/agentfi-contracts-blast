# Helper script to run forked test suites

function blastsepolia {
  export BLAST_SEPOLIA_FORK_BLOCK=2311403 
  export FORK_NETWORK=blastsepolia 
  npx hardhat test ./test/BalanceFetcher.blastsepolia.test.ts
}

function all {
  blastsepolia
}

${@:-all}