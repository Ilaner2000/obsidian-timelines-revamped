import Arrow from 'timeline-arrows';
import { DataInterface, DataSet } from 'vis-data';
import { DataGroup, Timeline, TimelineGroupEditableOption, TimelineOptionsGroupHeightModeType } from 'vis-timeline/esnext';
import { makeArrowsArray } from '.';
import {
  CardContainer,
  CombinedTimelineEventData,
  EventItem,
  HorizontalTimelineInput,
  MinimalGroup
} from '../types';
import {
  buildCombinedTimelineDataObject,
  buildTimelineDate,
  createInternalLinkOnNoteCard,
  handleColor,
  logger,
} from '../utils';

/**
 * 建立水平時間軸
 */
export async function buildHorizontalTimeline(
  {
    args,
    div: timelineDiv,
    dates: timelineDates,
    el,
    notes: timelineNotes,
    settings,
  }: HorizontalTimelineInput
) {
  // 用於存儲所有時間軸事件項目的 DataSet
  const items = new DataSet<CombinedTimelineEventData>([]);

  const desiredOrder = args.groupOrder ?? [];
  // 自訂群組排序邏輯：空內容群組優先，其次按 desiredOrder，最後按 value 排序
  const groupOrderFn: (a: MinimalGroup, b: MinimalGroup) => number =
    (a, b) => {
      const emptyA = a.content === '';
      const emptyB = b.content === '';
      if (emptyA && !emptyB) return -1;
      if (emptyB && !emptyA) return 1;
      if (desiredOrder.length > 0) {
        const ia = desiredOrder.indexOf(a.content);
        const ib = desiredOrder.indexOf(b.content);
        const pa = ia >= 0 ? ia : desiredOrder.length;
        const pb = ib >= 0 ? ib : desiredOrder.length;
        return pa - pb;
      }
      return a.value - b.value;
    };

  if (!timelineDates) {
    logger('buildHorizontalTimeline | No dates found for the timeline');
    return;
  }

  // 初始化群組陣列，包含一個預設群組
  const initialGroups: MinimalGroup[] = [
    {
      content: '',
      id: 1,
      value: 1,
    },
  ];

  // 遍歷日期和筆記，建立時間軸項目並動態發現/建立群組
  timelineDates.forEach((date) => {
    Object.values(timelineNotes[date]).forEach((event: CardContainer) => {
      const noteCard = document.createElement('div');
      // ... (項目卡片 DOM 建立邏輯) ...
      noteCard.className = 'timeline-card ' + event.classes;
      let colorIsClass = false;
      let end: Date | null = null;
      let type: string = event.type;
      let typeOverride = false;

      if (event.img) {
        noteCard.createDiv({
          cls: 'thumb',
          attr: { style: `background-image: url(${event.img});` }
        });
      }
      if (event.color) {
        colorIsClass = handleColor(event.color, noteCard, event.id);
      }
      createInternalLinkOnNoteCard(event, noteCard);
      noteCard.createEl('p', { text: event.body });

      const start = buildTimelineDate(event.startDate.normalizedDateString, parseInt(settings.maxDigits));
      if (!start) {
        console.warn("buildHorizontalTimeline | Couldn't build the starting timeline date", { start, event });
        return;
      }
      if (event.endDate.normalizedDateString && event.endDate.normalizedDateString !== '') {
        end = buildTimelineDate(event.endDate.normalizedDateString, parseInt(settings.maxDigits));
      } else {
        type = 'point';
        typeOverride = true;
      }
      if (end?.toString() === 'Invalid Date') {
        console.warn('buildHorizontalTimeline | Invalid end date', { end, event });
        return;
      }

      const initialClassName = colorIsClass ? event.color ?? 'gray' : `nid-${event.id}`;
      const defaultGroup = initialGroups[0];
      let foundGroup = initialGroups.find((group) => group.content === event.group);

      // 如果找不到現有群組且事件指定了群組，則建立新群組
      if (!foundGroup && event.group) {
        const newGroup: MinimalGroup & { subgroupOrder?: any; subgroupStack?: boolean } = {
          content: event.group,
          id: initialGroups.length + 1,
          value: initialGroups.length + 1,
          // 為新群組定義子群組排序和堆疊行為
          subgroupOrder: (a: any, b: any) => String(a.subgroup).localeCompare(String(b.subgroup)),
          subgroupStack: true,
        };
        initialGroups.push(newGroup);
        foundGroup = newGroup;
      }
      const subgroup = (event as any).subgroup ?? undefined;
      const eventItem: EventItem = {
        id: items.length + 1,
        content: event.title ?? '',
        className: initialClassName + ' ' + event.classes,
        end: end ?? undefined,
        group: foundGroup?.id ?? defaultGroup.id,
        subgroup,
        path: event.path,
        start: start,
        type: typeOverride ? type : event.type,
        _event: event,
      };
      items.add(buildCombinedTimelineDataObject(eventItem));
    });
  });

  // 過濾出實際使用到的群組
  const usedGroupIds = new Set<number>();
  items.forEach((it) => { if (it.group) usedGroupIds.add(it.group as number); });
  const finalVisibleGroups = initialGroups.filter(g => usedGroupIds.has(g.id));

  // 【重要】存儲原始且最終可見的群組定義。這是啟用/停用群組功能時的群組狀態「真實來源」。
  const originalGroupDataSet = new DataSet<MinimalGroup>(
    finalVisibleGroups.map(g => ({ ...g, visible: true }))
  );

  // Vis Timeline 的核心配置選項
  const options = {
    end: args.endDate,
    min: args.minDate,
    minHeight: args.divHeight,
    max: args.maxDate,
    start: args.startDate,
    zoomMax: args.zoomOutLimit,
    zoomMin: args.zoomInLimit,
    showCurrentTime: false,
    showTooltips: false,
    groupEditable: { order: true } as TimelineGroupEditableOption,
    groupHeightMode: 'fitItems' as TimelineOptionsGroupHeightModeType,
    groupOrder: groupOrderFn,
    orientation: { axis: 'both' },
    groupOrderSwap: (a: MinimalGroup, b: MinimalGroup, allGroups: DataInterface<DataGroup, 'id'>): void => {
      const temp = a.value;
      a.value = b.value;
      b.value = temp;
    },
    stack: true,
    stackSubgroups: true, // 子群組堆疊的初始狀態
    margin: { item: { horizontal: 0 } },
    // 自訂時間軸項目的渲染方式
    template: (item: EventItem) => {
      const eventContainer = document.createElement(settings.notePreviewOnHover ? 'a' : 'div');
      if ('href' in eventContainer) {
        eventContainer.addClass('internal-link');
        eventContainer.href = item.path;
      }
      eventContainer.setText(item.content);
      return eventContainer;
    }
  };

  timelineDiv.setAttribute('class', 'timeline-vis');
  // 使用項目、群組和選項實例化時間軸
  const timeline = new Timeline(timelineDiv, items, originalGroupDataSet, options);

  // 建立控制項的容器
  const controls = document.createElement('div');
  controls.className = 'tl-controls';
  el.prepend(controls);

  // --- 子群組切換按鈕 ---
  const toggleSubgroupBtn = document.createElement('button');
  toggleSubgroupBtn.textContent = '隐藏 subgroup'; // 初始文字，假設堆疊為開啟
  toggleSubgroupBtn.className = 'tl-subgroup-toggle';
  let subgroupsAreStacked = true; // 初始狀態與 options.stackSubgroups 一致
  toggleSubgroupBtn.addEventListener('click', () => {
    subgroupsAreStacked = !subgroupsAreStacked;
    toggleSubgroupBtn.textContent = subgroupsAreStacked ? '隐藏 subgroup' : '顯示 subgroup';
    // 更新時間軸的 stackSubgroups 選項
    timeline.setOptions({ stackSubgroups: subgroupsAreStacked });
  });
  controls.appendChild(toggleSubgroupBtn);

  // --- 群組可見性下拉選單 ---
  const groupVisibilityBtn = document.createElement('button');
  const groupVisibilityMenu = document.createElement('div');
  groupVisibilityBtn.textContent = 'Groups';
  groupVisibilityBtn.className = 'tl-group-toggle-btn';
  groupVisibilityMenu.className = 'tl-group-menu';
  groupVisibilityMenu.style.display = 'none'; // 初始隱藏

  controls.appendChild(groupVisibilityBtn);
  controls.appendChild(groupVisibilityMenu);

  const groupCheckboxes: HTMLInputElement[] = [];
  finalVisibleGroups.forEach(g => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true; // 初始所有群組可見
    cb.addEventListener('change', () => {
      // 【重要】直接更新 originalGroupDataSet 中的群組可見性狀態
      originalGroupDataSet.update({ id: g.id, visible: cb.checked });
    });
    label.append(cb, document.createTextNode(g.content || 'Default'));
    groupVisibilityMenu.appendChild(label);
    groupCheckboxes.push(cb);
  });

  // 處理點擊選單外部以關閉選單的邏輯
  const handleClickOutsideGroupMenu = (event: MouseEvent) => {
    if (
      groupVisibilityMenu.style.display === 'block' &&
      !groupVisibilityMenu.contains(event.target as Node) &&
      event.target !== groupVisibilityBtn &&
      !groupVisibilityBtn.contains(event.target as Node)
    ) {
      groupVisibilityMenu.style.display = 'none';
      document.removeEventListener('click', handleClickOutsideGroupMenu, true);
    }
  };

  groupVisibilityBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const isMenuVisible = groupVisibilityMenu.style.display === 'block';
    if (isMenuVisible) {
      groupVisibilityMenu.style.display = 'none';
      document.removeEventListener('click', handleClickOutsideGroupMenu, true);
    } else {
      groupVisibilityMenu.style.display = 'block';
      document.addEventListener('click', handleClickOutsideGroupMenu, true);
    }
  });

  // --- 新增：啟用/停用群組按鈕 ---
  const toggleGroupingBtn = document.createElement('button');
  toggleGroupingBtn.className = 'tl-toggle-grouping-btn';
  let isGroupingEnabled = true; // 時間軸初始啟用群組
  toggleGroupingBtn.textContent = 'Disable Grouping';

  toggleGroupingBtn.addEventListener('click', () => {
    isGroupingEnabled = !isGroupingEnabled;
    toggleGroupingBtn.textContent = isGroupingEnabled ? 'Disable Grouping' : 'Enable Grouping';

    if (isGroupingEnabled) {
      // 啟用群組時：從 originalGroupDataSet 恢復群組，並顯示相關控制項
      timeline.setGroups(originalGroupDataSet);
      toggleSubgroupBtn.style.display = '';
      groupVisibilityBtn.style.display = '';
      timeline.setOptions({ stackSubgroups: subgroupsAreStacked }); // 恢復子群組堆疊狀態
    } else {
      // 停用群組時：從時間軸移除所有群組，並隱藏相關控制項
      timeline.setGroups(undefined);
      toggleSubgroupBtn.style.display = 'none';
      groupVisibilityBtn.style.display = 'none';
      if (groupVisibilityMenu.style.display === 'block') { // 若選單開啟則關閉
        groupVisibilityMenu.style.display = 'none';
        document.removeEventListener('click', handleClickOutsideGroupMenu, true);
      }
    }
  });
  controls.appendChild(toggleGroupingBtn);
  // --- 結束新增按鈕 ---

  el.appendChild(timelineDiv);

  // 建立並繪製項目之間的箭頭
  const arrows = makeArrowsArray(items);
  if (arrows.length > 0) {
    const myArrows = new Arrow(timeline, arrows);
  }

  // 處理滑鼠懸停在時間軸項目上的事件，用於樣式變化
  timeline.on('itemover', (props) => {
    const event = items.get(props.item) as unknown as EventItem;
    if (!event) return;
    const newClass = (event.className || '').split(' runtime-hover')[0] + ' runtime-hover';
    document.documentElement.style.setProperty('--hoverHighlightColor', event._event?.color ?? 'white');
    items.updateOnly([{ id: event.id, className: newClass }]);
  });

  // 處理滑鼠移開時間軸項目的事件
  timeline.on('itemout', (props) => {
    const event = items.get(props.item) as unknown as EventItem;
    if (!event) return;
    const originalClass = (event.className || '').split(' runtime-hover')[0];
    items.updateOnly([{ id: event.id, className: originalClass }]);
  });

}