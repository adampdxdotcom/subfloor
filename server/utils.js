// server/utils.js
export const toCamelCase = (obj) => {
  if (!obj) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item));
  }
  const newObj = {};
  for (let key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (key.includes('_')) {
        const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        newObj[camelKey] = obj[key];
      } else {
        newObj[key] = obj[key];
      }
    }
  }
  return newObj;
};