import type { Options } from 'react-markdown'
import type { Element, Root } from 'hast'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize'

const SAFE_SVG_TAGS = [
  'svg',
  'title',
  'desc',
  'defs',
  'g',
  'marker',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'clipPath',
  'mask',
  'pattern',
  'linearGradient',
  'radialGradient',
  'stop',
]

const SAFE_SVG_ATTRIBUTES = [
  'className',
  'role',
  'viewBox',
  'xmlns',
  'width',
  'height',
  'preserveAspectRatio',
  'transform',
  'd',
  'points',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'dx',
  'dy',
  'fill',
  'fillOpacity',
  'fillRule',
  'stroke',
  'strokeWidth',
  'strokeLinecap',
  'strokeLinejoin',
  'strokeMiterlimit',
  'strokeDasharray',
  'strokeDashoffset',
  'strokeOpacity',
  'opacity',
  'vectorEffect',
  'color',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'letterSpacing',
  'wordSpacing',
  'textLength',
  'lengthAdjust',
  'textAnchor',
  'dominantBaseline',
  'paintOrder',
  'clipPath',
  'mask',
  'markerStart',
  'markerMid',
  'markerEnd',
  'refX',
  'refY',
  'markerWidth',
  'markerHeight',
  'markerUnits',
  'orient',
  'offset',
  'stopColor',
  'stopOpacity',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
]

const SAFE_SVG_ATTRIBUTE_SCHEMA = Object.fromEntries(
  SAFE_SVG_TAGS.map((tagName) => [tagName, SAFE_SVG_ATTRIBUTES]),
) as NonNullable<SanitizeSchema['attributes']>

const MARKDOWN_HTML_SANITIZE_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...SAFE_SVG_TAGS],
  strip: [...(defaultSchema.strip ?? []), 'style', 'foreignObject'],
  attributes: {
    ...defaultSchema.attributes,
    ...SAFE_SVG_ATTRIBUTE_SCHEMA,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ['className', 'math-inline', 'math-display'],
    ],
  },
}

function isElement(node: Root['children'][number]): node is Element {
  return node.type === 'element'
}

function restoreSanitizedSvgReferences() {
  return (tree: Root) => {
    const visit = (node: Root | Element, insideSvg: boolean) => {
      for (const child of node.children) {
        if (!isElement(child)) continue
        const childInsideSvg = insideSvg || child.tagName === 'svg'
        if (childInsideSvg) {
          for (const property of ['fill', 'stroke', 'clipPath', 'mask', 'markerStart', 'markerMid', 'markerEnd']) {
            const value = child.properties[property]
            if (typeof value !== 'string' || !value.includes('url(')) continue
            const localReference = /^url\(#([A-Za-z0-9_.:-]+)\)$/.exec(value)
            if (!localReference) {
              delete child.properties[property]
              continue
            }
            child.properties[property] = `url(#user-content-${localReference[1]})`
          }
        }
        visit(child, childInsideSvg)
      }
    }
    visit(tree, false)
  }
}

export const MARKDOWN_HTML_REHYPE_PLUGINS: NonNullable<Options['rehypePlugins']> = [
  rehypeRaw,
  [rehypeSanitize, MARKDOWN_HTML_SANITIZE_SCHEMA],
  restoreSanitizedSvgReferences,
]
