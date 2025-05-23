import { isNaN } from 'lodash'

import { buildTimelineDate } from './dates'
import { logger } from './debug'
import { InternalTimelineArgs, ParsedTagObject, TimelinesSettings } from '../types'
import { DEFAULT_SETTINGS } from '../constants'

export function setDefaultArgs( settings: TimelinesSettings ): InternalTimelineArgs {
  const { verticalTimelineDateDisplayFormat: defaultVerticalDateFormat } = DEFAULT_SETTINGS
  const { verticalTimelineDateDisplayFormat: dateFormatFromSettings } = settings

  logger( 'setDefaultArgs |', { dateFormatFromSettings, defaultVerticalDateFormat })

  let useNewDefaultFormat = false
  if ( dateFormatFromSettings !== defaultVerticalDateFormat ) {
    logger( 'setDefaultArgs | using new default format' )
    useNewDefaultFormat = true
  }

  return {
    tags: {
      tagList: [],
      optionalTags: [],
    },
    dateFormat: useNewDefaultFormat ? dateFormatFromSettings : defaultVerticalDateFormat,
    divHeight: 400,
    startDate: buildTimelineDate( '-1000' )!,
    endDate: buildTimelineDate( '3000' )!,
    minDate: buildTimelineDate( '-3000' )!,
    maxDate: buildTimelineDate( '3000' )!,
    type: null,

    // have to put it to one more than the default max so that min actually works
    zoomOutLimit: 315360000000001,
    zoomInLimit: 10,
  }
}

export const createTagList = ( tagString: string, timelineTag: string ): ParsedTagObject => {
  const parsedTags: ParsedTagObject = {
    tagList: [],
    optionalTags: []
  }

  // 新增：檢查是否是 RegExp (以 / 開始與結尾)
  if (tagString.trim().startsWith('/') && tagString.trim().endsWith('/')) {
    parsedTags.tagList.push(tagString.trim())
    parsedTags.tagList.push(timelineTag)
    return parsedTags
  }

  tagString.split( ';' ).forEach(( tag: string ) => {
    if ( tag.includes( '|' )) {
      return parseOrTags( tag, parsedTags.optionalTags )
    }

    return parseTag( tag, parsedTags.tagList )
  })
  parsedTags.tagList.push( timelineTag )

  return parsedTags
}

const parseOrTags = ( tagString: string, optionalTags: string[] ): void => {
  tagString.split( '|' ).forEach(( tag: string ) => {
    return parseTag( tag, optionalTags )
  })
}

/**
 * Parse a tag and all its subtags into a list.
 *
 * @param {String} tag - tag to parse
 * @param {String[]} tagList - list of tags to add to
 * @returns
 */
export function parseTag( tag: string, tagList: string[] ): void {
  tag = tag.trim()

  // Skip empty tags
  if ( tag.length === 0 ) {
    return
  }

  // Parse all subtags out of the given tag.
  // I.e., #hello/i/am would yield [#hello/i/am, #hello/i, #hello]. */
  tagList.push( tag )
  while ( tag.contains( '/' )) {
    tag = tag.substring( 0, tag.lastIndexOf( '/' ))
    tagList.push( tag )
  }
}

/**
 * Convert a timeframe string to milliseconds
 *
 * @param {string} timeframe - timeframe string to convert
 *
 * @returns {number} milliseconds
 */
export const convertEntryToMilliseconds = ( timeframe: string ): number => {
  let msNumber: number = 10

  const userTimeframe = parseInt( timeframe )
  if ( !isNaN( userTimeframe )) {
    // the user knows exactly what they want
    return userTimeframe
  }

  switch ( timeframe ) {
  case 'day':
    // shows hours
    msNumber = 1000 * 60 * 60 * 24 // 86400000
    break
  case 'week':
    // shows days, about a week at a time
    msNumber = 1000 * 60 * 60 * 24 * 7 // 604800000
    break
  case 'month-detail':
    // shows days, about a month at a time
    msNumber = 1000 * 60 * 60 * 24 * 31 // 2678400000
    break
  case 'month-vague':
    // shows months, about a month at a time
    msNumber = 1000 * 60 * 60 * 24 * 32 // 2764800000
    break
  case 'year':
    // shows months, about a year at a time
    msNumber = 1000 * 60 * 60 * 24 * 31 * 12 // 32140800000
    break
  default:
    console.error( `Invalid timeframe: ${timeframe}` )
    break
  }

  return msNumber
}
