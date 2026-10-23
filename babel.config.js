module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-worklets-core/plugin'],
      // reanimated's plugin must stay last
      'react-native-reanimated/plugin',
    ],
  };
};
