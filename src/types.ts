import { FrontMatterCache, MetadataCache, TFile, Vault } from 'obsidian'
import { DataItem } from 'vis-timeline'

/* ------------------------------ */
/*              Enums             */
/* ------------------------------ */

export enum AcceptableEventElements {
  div = 'div',
  span = 'span',
}

/* ------------------------------ */
/*           Interfaces           */
/* ------------------------------ */

export interface ArrowObject {
  id: number,
  id_item_1: number,
  id_item_2: number,
  title?: string,
}

export interface CleanedDateResultObject {
  // full items
  cleanedDateString: string,
  normalizedDateString: string,
  originalDateString: string,
  readableDateString: string,

  // parts
  day: number,
  hour: number,
  month: number,
  year: number
}

export interface CardContainer {
  id: string,
  body: string,
  classes: string,
  color: string,
  endDate: CleanedDateResultObject,
  era: string,
  group: string,
  subgroup?: string,   // ★ 加入
  img: string,
  path: string,
  pointsTo: string,
  startDate: CleanedDateResultObject,
  title: string,
  type: string,
}

export interface EventDataObject {
  classes: string,
  color: string,
  endDate: string,
  era: string,
  eventImg: string,
  group: string,
  subgroup: string,   // ★ 加入
  noteBody: string,
  notePath: string,
  noteTitle: string,
  pointsTo: string,
  showOnTimeline: boolean | null,
  startDate: string,
  tags: string,
  type: string,
}

export interface EventItem {
  id: number,
  className: string,
  content: string,
  end: Date | undefined,
  group: number,
  subgroup?: string | number,   // 新增
  path: string,
  start: Date,
  type: string,
  _event?: Partial<CardContainer>,
}

export interface EventTypeNumbers {
  numEvents: number,
  numFrontMatter: number,
  totalEvents: number,
}

export interface FrontMatterKeys {
  endDateKey: string[],
  startDateKey: string[],
  titleKey: string[],
}

export interface GetFileDataInput {
  file: TFile | null,
  appVault: Vault | null,
  fileCache: MetadataCache | null,
}

export interface HorizontalTimelineInput {
  args: InternalTimelineArgs,
  dates: string[],
  div: HTMLElement,
  el: HTMLElement,
  notes: AllNotesData,
  settings: TimelinesSettings,
}

export interface InternalTimelineArgs {
  dateFormat: string,
  divHeight: number,
  endDate: Date,
  maxDate: Date,
  minDate: Date,
  startDate: Date,
  tags: ParsedTagObject,
  type: string | null,
  zoomInLimit: number,
  zoomOutLimit: number,
  groupOrder?: string[]   // 新增：從 code-block 讀進來的排序清單
}

export interface MinimalGroup {
  content: string,
  id: number,
  value: number,
  /** 是否顯示，給 DataSet 動態更新用 */
  visible?: boolean;
}

export interface ParsedTagObject {
  tagList: string[],
  optionalTags: string[],
}

export interface TimelinesSettings {
  eventElement: AcceptableEventElements,
  frontMatterKeys: FrontMatterKeys,
  notePreviewOnHover: boolean,
  showEventCounter: boolean,
  sortDirection: boolean,
  timelineTag: string,
  maxDigits: string,
  verticalTimelineDateDisplayFormat: string,
}

/* ------------------------------ */
/*              Types             */
/* ------------------------------ */

export type AllNotesData = ( CardContainer[] )[]
export type CombinedTimelineEventData = EventItem & DataItem
export type DivWithCalcFunc = HTMLDivElement & { calcLength?: () => void }
export type EventCountData = ( HTMLElement | FrontMatterCache | null )[]
