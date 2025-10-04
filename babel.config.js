// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [

      // ต้องเป็นตัวสุดท้าย
      'react-native-worklets/plugin',
    ],
  };
};
