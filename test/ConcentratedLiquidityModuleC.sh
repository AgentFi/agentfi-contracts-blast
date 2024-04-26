#!/bin/bash

# Need to set chainid for, as fork still runs on default hardhat chainid
export HARDHAT_CHAIN_ID=81457
npx hardhat test ./test/ConcentratedLiquidityModuleC.test.ts ./test/ConcentratedLiquidityGatewayModuleC.test.ts