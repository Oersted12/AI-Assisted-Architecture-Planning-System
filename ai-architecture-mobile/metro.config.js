const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const expoCliNegotiator =
  /node_modules[\\/]+expo[\\/]+node_modules[\\/]+negotiator([\\/]+|$)/;
const blockList = config.resolver.blockList;

config.resolver.blockList = Array.isArray(blockList)
  ? [...blockList, expoCliNegotiator]
  : [blockList, expoCliNegotiator].filter(Boolean);

module.exports = config;
