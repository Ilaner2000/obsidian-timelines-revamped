import {
  getAllTags,
  MetadataCache,
  MarkdownView,
  TFile,
  Workspace,
  Vault,
  normalizePath
} from 'obsidian'
import { CardContainer } from '../types'
import { logger } from './debug'
import { parseTag } from './arguments'

export * from './arguments'
export * from './colors'
export * from './dates'
export * from './debug'
export * from './events'
export * from './frontmatter'

/**
 * Filter markdown files by tag
 *
 * @param {TFile} file - file to filter, see Obsidian's {@link TFile}
 * @param {String[]} tagList - list of tags to filter by
 * @param {MetadataCache} metadataCache - See Obsidian's {@link MetadataCache}
 * @returns {boolean} true if file contains all tags in tagList, false otherwise
 */
export function filterMdFiles(file: TFile, tags: string[], metadataCache: MetadataCache, parseOptional: boolean): boolean {
  logger('filterMDFiles | -----------------')
  if (!tags || tags.length === 0) {
    return true
  }

  const cache = metadataCache.getFileCache(file)
  if (!cache) {
    throw new Error("Failed to get the file's metadataCache")
  }

  const rawTags = getAllTags(cache)
  logger(`filterMDFiles | rawTags from file: ${file.name}:`, rawTags)

  const mappedTags = rawTags?.map((e) => e.slice(1)) ?? []
  logger(`filterMDFiles | getAllTags from file: ${file.name}:`, mappedTags)

  if (!mappedTags.length) {
    return false
  }

  const fileTags: string[] = []
  mappedTags.forEach((tag) => {
    return parseTag(tag, fileTags)
  })

  const testTags = (val: string): boolean => {
    // 把全部的 tags 合併成一個字串（方便用正則同時檢查所有 tag）
    const fileTagsString = fileTags.join(' ')

    if (val.startsWith('/') && val.endsWith('/')) {
      try {
        const regex = new RegExp(val.slice(1, -1))
        return regex.test(fileTagsString)
      } catch (e) {
        console.error('Invalid RegExp in tags:', val, e)
        return fileTags.includes(val)
      }
    } else {
      return fileTags.includes(val)
    }
  }


  if (parseOptional) {
    return tags.some(testTags)
  } else {
    return tags.every(testTags)
  }
}
/**
 * Return URL for specified image path
 *
 * @param {String} path - image path
 * @param {Vault} vault - See Obsidian's {@link Vault}
 *
 * @returns {string|null} URL for image
 */
export function getImgUrl( vault: Vault, path: string ): string {
  if ( !path ) {
    return ''
  }

  if ( path.includes( 'https://' )) {
    return path
  }

  const file = vault.getAbstractFileByPath( normalizePath( path ))
  if ( file instanceof TFile ) {
    return vault.getResourcePath( file )
  }

  return ''
}

/**
 * Create an internal link on the a timeline's event "note" card
 *
 * @param event
 * @param noteCard
 */
export const createInternalLinkOnNoteCard = ( event: CardContainer, noteCard: HTMLElement ) => {
  noteCard
    .createEl( 'article' )
    .createEl( 'h3' )
    .createEl( 'a', {
      cls: 'internal-link',
      attr: { href: `${normalizePath( event.path )}` },
      text: event.title
    })
}

export const confirmUserInEditor = ( workspace: Workspace ) => {
  const view = workspace.getActiveViewOfType( MarkdownView )
  if ( !view ) {
    throw new Error( 'No active MarkdownView' )
  }

  const editor = view.editor
  if ( !editor ) {
    throw new Error( 'Could not retrieve editor' )
  }

  return editor
}
