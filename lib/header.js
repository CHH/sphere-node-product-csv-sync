/* ===========================================================
# sphere-node-product-csv-sync - v0.5.7
# ==============================================================
# Copyright (c) 2014 Hajo Eichler
# Licensed under the MIT license.
*/
var CONS, GLOBALS, Header, _;

_ = require('underscore');

CONS = require('../lib/constants');

GLOBALS = require('../lib/globals');

Header = (function() {
  function Header(rawHeader) {
    this.rawHeader = rawHeader;
  }

  Header.prototype.validate = function() {
    var errors, missingHeader, missingHeaders, _i, _len;
    errors = [];
    if (this.rawHeader.length !== _.unique(this.rawHeader).length) {
      errors.push("There are duplicate header entries!");
    }
    missingHeaders = _.difference([CONS.HEADER_PRODUCT_TYPE], this.rawHeader);
    if (_.size(missingHeaders) > 0) {
      for (_i = 0, _len = missingHeaders.length; _i < _len; _i++) {
        missingHeader = missingHeaders[_i];
        errors.push("Can't find necessary base header '" + missingHeader + "'!");
      }
    }
    if (!_.contains(this.rawHeader, CONS.HEADER_VARIANT_ID) && !_.contains(this.rawHeader, CONS.HEADER_SKU)) {
      errors.push("You need either the column '" + CONS.HEADER_VARIANT_ID + "' or '" + CONS.HEADER_SKU + "' to identify your variants!");
    }
    return errors;
  };

  Header.prototype.toIndex = function(name) {
    this.h2i = _.object(_.map(this.rawHeader, function(head, index) {
      if (!this.h2i) {
        return [head, index];
      }
    }));
    if (name) {
      return this.h2i[name];
    }
    return this.h2i;
  };

  Header.prototype.has = function(name) {
    if (this.h2i == null) {
      this.toIndex();
    }
    return _.has(this.h2i, name);
  };

  Header.prototype.toLanguageIndex = function(name) {
    if (!this.langH2i) {
      this.langH2i = this._languageToIndex(CONS.BASE_LOCALIZED_HEADERS);
    }
    if (name) {
      return this.langH2i[name];
    }
    return this.langH2i;
  };

  Header.prototype.hasLanguageForBaseAttribute = function(name) {
    return _.has(this.langH2i, name);
  };

  Header.prototype.hasLanguageForCustomAttribute = function(name) {
    var foo;
    foo = _.find(this.productTypeId2HeaderIndex, function(productTypeLangH2i) {
      return _.has(productTypeLangH2i, name);
    });
    return foo != null;
  };

  Header.prototype.productTypeAttributeToIndex = function(productType, attribute) {
    return this._productTypeLanguageIndexes(productType)[attribute.name];
  };

  Header.prototype._languageToIndex = function(localizedAttributes) {
    var head, index, lang, langAttribName, langH2i, parts, _i, _j, _len, _len1, _ref;
    langH2i = {};
    for (_i = 0, _len = localizedAttributes.length; _i < _len; _i++) {
      langAttribName = localizedAttributes[_i];
      _ref = this.rawHeader;
      for (index = _j = 0, _len1 = _ref.length; _j < _len1; index = ++_j) {
        head = _ref[index];
        parts = head.split(GLOBALS.DELIM_HEADER_LANGUAGE);
        if (_.size(parts) === 2) {
          if (parts[0] === langAttribName) {
            lang = parts[1];
            langH2i[langAttribName] || (langH2i[langAttribName] = {});
            langH2i[langAttribName][lang] = index;
          }
        }
      }
    }
    return langH2i;
  };

  Header.prototype._productTypeLanguageIndexes = function(productType) {
    var langH2i, ptLanguageAttributes;
    this.productTypeId2HeaderIndex || (this.productTypeId2HeaderIndex = {});
    langH2i = this.productTypeId2HeaderIndex[productType.id];
    if (!langH2i) {
      ptLanguageAttributes = _.map(productType.attributes, function(attribute) {
        var _ref;
        if ((attribute.type.name === CONS.ATTRIBUTE_TYPE_LTEXT) || (attribute.type.name === CONS.ATTRIBUTE_TYPE_SET && ((_ref = attribute.type.elementType) != null ? _ref.name : void 0) === CONS.ATTRIBUTE_TYPE_LTEXT)) {
          return attribute.name;
        }
      });
      langH2i = this._languageToIndex(ptLanguageAttributes);
      this.productTypeId2HeaderIndex[productType.id] = langH2i;
    }
    return langH2i;
  };

  Header.prototype.missingHeaderForProductType = function(productType) {
    this.toIndex();
    return _.filter(productType.attributes, (function(_this) {
      return function(attribute) {
        return !_this.has(attribute.name) && !_this.productTypeAttributeToIndex(productType, attribute);
      };
    })(this));
  };

  return Header;

})();

module.exports = Header;
