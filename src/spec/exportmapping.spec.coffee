_ = require('underscore')._
ExportMapping = require '../lib/exportmapping'
Header = require '../lib/header'
Types = require '../lib/types'
CONS = require '../lib/constants'

describe 'ExportMapping', ->
  beforeEach ->
    @exportMapping = new ExportMapping()

  describe '#constructor', ->
    it 'should initialize', ->
      expect(@exportMapping).toBeDefined()

  describe '#mapPrices', ->
    it 'should map simple price', ->
      prices = [
        { value: { centAmount: 999, currencyCode: 'EUR' } }
      ]
      expect(@exportMapping.mapPrices prices).toBe 'EUR 999'

    it 'should map multiple prices', ->
      prices = [
        { value: { centAmount: 999, currencyCode: 'EUR' } }
        { value: { centAmount: 1099, currencyCode: 'USD' } }
        { value: { centAmount: 1299, currencyCode: 'CHF' } }
      ]
      expect(@exportMapping.mapPrices prices).toBe 'EUR 999;USD 1099;CHF 1299'

  describe '#mapImage', ->
    it 'should map single image', ->
      images = [
        { url: '//example.com/image.jpg' }
      ]
      expect(@exportMapping.mapImages images).toBe '//example.com/image.jpg'

    it 'should map multiple images', ->
      images = [
        { url: '//example.com/image.jpg' }
        { url: 'https://www.example.com/pic.png' }
      ]
      expect(@exportMapping.mapImages images).toBe '//example.com/image.jpg;https://www.example.com/pic.png'


  describe '#mapAttribute', ->
    beforeEach ->
      @exportMapping.types = new Types()
      @productType =
        id: '123'
        attributes: [
          { name: 'myTextAttrib', type: { name: 'text' } }
          { name: 'myEnumAttrib', type: { name: 'enum' } }
          { name: 'myTextSetAttrib', type: { name: 'set', elementType: { name: 'text' } } }
          { name: 'myEnumSetAttrib', type: { name: 'set', elementType: { name: 'lenum' } } }
        ]
      @exportMapping.types.buildMaps [@productType]

    it 'should map simple attribute', ->
      attribute =
        name: 'myTextAttrib'
        value: 'some text'
      expect(@exportMapping.mapAttribute attribute, @productType.attributes[0].type).toBe 'some text'

    it 'should map enum attribute', ->
      attribute =
        name: 'myEnumAttrib'
        value:
          label:
            en: 'bla'
          key: 'myEnum'
      expect(@exportMapping.mapAttribute attribute, @productType.attributes[1].type).toBe 'myEnum'

    it 'should map text set attribute', ->
      attribute =
        name: 'myTextSetAttrib'
        value: [ 'x', 'y', 'z' ]
      expect(@exportMapping.mapAttribute attribute, @productType.attributes[2].type).toBe 'x;y;z'

    it 'should map enum set attribute', ->
      attribute =
        name: 'foo'
        value: [
          { label:
              en: 'bla'
            key: 'myEnum' }
          { label:
              en: 'foo'
            key: 'myEnum2' }
        ]
      expect(@exportMapping.mapAttribute attribute, @productType.attributes[3].type).toBe 'myEnum;myEnum2'

  describe '#mapVariant', ->
    it 'should map variant id and sku', ->
      @exportMapping.header = new Header([CONS.HEADER_VARIANT_ID, CONS.HEADER_SKU])
      @exportMapping.header.toIndex()
      variant =
        id: '12'
        sku: 'mySKU'
        attributes: []
      row = @exportMapping.mapVariant(variant)
      expect(row).toEqual [ '12', 'mySKU' ]

    it 'should map variant attributes', ->
      @exportMapping.header = new Header([ 'foo' ])
      @exportMapping.header.toIndex()
      @exportMapping.types = new Types()
      productType =
        id: '123'
        attributes: [
          { name: 'foo', type: { name: 'text' } }
        ]
      @exportMapping.types.buildMaps [productType]
      variant =
        attributes: [
          { name: 'foo', value: 'bar' }
        ]
      row = @exportMapping.mapVariant(variant, productType)
      expect(row).toEqual [ 'bar' ]

  describe '#mapBaseProduct', ->
    it 'should map productType, id and tax', ->
      @exportMapping.header = new Header([CONS.HEADER_PRODUCT_TYPE,CONS.HEADER_ID,CONS.HEADER_TAX])
      @exportMapping.header.toIndex()
      product =
        id: '123'
        masterVariant:
          attributes: []
        taxCategory:
          id: 'myTax'
      type =
        name: 'myType'
        id: 'typeId123'
      row = @exportMapping.mapBaseProduct(product, type)
      expect(row).toEqual [ 'myType', '123', 'myTax' ]

    it 'should map localized base attributes', ->
      @exportMapping.header = new Header(['name.de','slug.it','description.en'])
      @exportMapping.header.toIndex()
      product =
        id: '123'
        masterVariant:
          attributes: []
        name:
          de: 'Hallo'
          en: 'Hello'
          it: 'Ciao'
        slug:
          de: 'hallo'
          en: 'hello'
          it: 'ciao'
        description:
          de: 'Bla bla'
          en: 'Foo bar'
          it: 'Ciao Bella'

      row = @exportMapping.mapBaseProduct(product, {})
      expect(row).toEqual [ 'Hallo', 'ciao', 'Foo bar' ]