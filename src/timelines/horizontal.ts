import Arrow from 'timeline-arrows'
import { DataInterface, DataSet } from 'vis-data'
import { DataGroup, Timeline, TimelineGroupEditableOption, TimelineOptionsGroupHeightModeType } from 'vis-timeline/esnext'

import { makeArrowsArray } from '.'
import {
  CardContainer,
  CombinedTimelineEventData,
  EventItem,
  HorizontalTimelineInput,
  MinimalGroup
} from '../types'
import {
  buildCombinedTimelineDataObject,
  buildTimelineDate,
  createInternalLinkOnNoteCard,
  handleColor,
  logger,
} from '../utils'

/**
   * Build a horizontal timeline
   *
   * @param timelineDiv - the timeline html element
   * @param timelineNotes - notes which have our timeline tags
   * @param timelineDates - dates we parsed from event data
   * @param el - the element to append the timeline to
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
  // Create a DataSet
  const items = new DataSet<CombinedTimelineEventData>( [] )

  // 1️⃣ 新增：讀 code-block 傳的 groupOrder
  const desiredOrder = args.groupOrder ?? [];
  // 2️⃣ 改寫這段
  const groupOrderFn: (a: MinimalGroup, b: MinimalGroup) => number =
    (a, b) => {
      // ☆ 先把空 group 逼到最上面
      const emptyA = a.content === '';
      const emptyB = b.content === '';
      if (emptyA && !emptyB) return -1;
      if (emptyB && !emptyA) return 1;

      // ☆ 再套用你原本的自訂排序（code-block 傳的）
      if (desiredOrder.length > 0) {
        const ia = desiredOrder.indexOf(a.content);
        const ib = desiredOrder.indexOf(b.content);
        const pa = ia >= 0 ? ia : desiredOrder.length;
        const pb = ib >= 0 ? ib : desiredOrder.length;
        return pa - pb;
      }
      // ☆ 最後退回 value 排序
      return a.value - b.value;
    };

  if ( !timelineDates ) {
    logger( 'buildHorizontalTimeline | No dates found for the timeline' )
    return
  }

  const groups: MinimalGroup[] = [
    {
      // default group
      content: '',
      id: 1,
      value: 1,
    },
  ]
  

  timelineDates.forEach(( date ) => {
    // add all events at this date
    Object.values( timelineNotes[date] ).forEach(( event: CardContainer ) => {
      const noteCard = document.createElement( 'div' )
      noteCard.className = 'timeline-card ' + event.classes
      let colorIsClass = false
      let end: Date | null = null
      let type: string = event.type
      let typeOverride = false

      // add an image only if available
      if ( event.img ) {
        noteCard.createDiv({
          cls: 'thumb',
          attr: { style: `background-image: url(${event.img});` }
        })
      }

      if ( event.color ) {
        colorIsClass = handleColor( event.color, noteCard, event.id )
      }

      createInternalLinkOnNoteCard( event, noteCard )
      noteCard.createEl( 'p', { text: event.body })
      
      const start = buildTimelineDate( event.startDate.normalizedDateString, parseInt( settings.maxDigits ))
      if ( !start ) {
        console.warn(
          "buildHorizontalTimeline | Couldn't build the starting timeline date for the horizontal timeline",
          'buildHorizontalTimeline | Invalid start date - check for Month/Day values that are 0',
          { start, event }
        )
        return
      }

      if ( event.endDate.normalizedDateString && event.endDate.normalizedDateString !== '' ) {
        logger( 'buildHorizontalTimeline | there is an endDate for event:', event )
        end = buildTimelineDate( event.endDate.normalizedDateString, parseInt( settings.maxDigits ))
      } else {
        // if there is no end date, we cannot render as anything other than 'point'
        logger( 'buildHorizontalTimeline | NO endDate for event:', event )
        type = 'point'
        typeOverride = true
      }

      if ( end?.toString() === 'Invalid Date' ) {
        console.warn(
          'buildHorizontalTimeline | Invalid end date - check for Month/Day values that are 0',
          { end, event }
        )

        return
      }

      const initialClassName = colorIsClass ? event.color ?? 'gray' : `nid-${event.id}`
      const defaultGroup = groups[0]
      let foundGroup = groups.find(( group ) => {
        return group.content === event.group 
      })
      if ( !foundGroup && event.group ) {
        const newGroup: MinimalGroup & { subgroupOrder?: any; subgroupStack?: boolean } = {
          content: event.group,
          id: groups.length + 1,
          value: groups.length + 1,

          // 讓同一大組下的小組照字母升序排
          subgroupOrder: (a: any, b: any) =>
            String(a.subgroup).localeCompare(String(b.subgroup)),

          // 要不要把同 subgroup 的項目再往上堆，視需求決定
          subgroupStack: true,
        }
        groups.push( newGroup )
        foundGroup = newGroup
      }

      // 取用筆記 front‑matter 或其他來源的 subgroup；若沒有就 undefined
      const subgroup = (event as any).subgroup ?? undefined;   // ★新增

      const eventItem: EventItem = {
        id:        items.length + 1,
        content:   event.title ?? '',
        className: initialClassName + ' ' + event.classes,
        end:       end ?? undefined,
        group:     foundGroup?.id ?? defaultGroup.id,
        subgroup,                                    
        path:      event.path,
        start:     start,
        type:      typeOverride ? type : event.type,
        _event:    event,
      }

      const timelineItem: CombinedTimelineEventData = buildCombinedTimelineDataObject( eventItem )

      // Add Event data
      items.add( timelineItem )
    })
  })
  const usedGroupIds = new Set<number>();
  items.forEach((it) => usedGroupIds.add(it.group as number));

  const visibleGroupArray = groups.filter(g => usedGroupIds.has(g.id));
  const groupDataSet = new DataSet<MinimalGroup>(
    // 在原始 group object 上面加上可选的 visible 属性
    visibleGroupArray.map(g => ({ ...g, visible: true }))
  );

  // Configuration for the Timeline
  const options = {
    end: args.endDate,
    min: args.minDate,
    minHeight: args.divHeight,
    max: args.maxDate,
    start: args.startDate,
    zoomMax: args.zoomOutLimit,
    zoomMin: args.zoomInLimit,

    // non-argument options
    showCurrentTime: false,
    showTooltips: false,
    groupEditable: {
      order: true,
    } as TimelineGroupEditableOption,
    groupHeightMode: 'fitItems' as TimelineOptionsGroupHeightModeType,
    groupOrder: groupOrderFn,  // 2️⃣ 取代原本的 a.value - b.value

    
    orientation: {
      axis: 'both' // <= 加這行！
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    groupOrderSwap: ( a: MinimalGroup, b: MinimalGroup, groups: DataInterface<DataGroup, 'id'> ): void => {
      const temp = a.value
      a.value = b.value
      b.value = temp
    },

    stack: true, 
    stackSubgroups: true,  // 只堆疊同一 subgroup
    margin: {
      item: {
        horizontal: 0              // ★ 預設 10，改成 0
      }
    },

    template: ( item: EventItem ) => {
      const eventContainer = document.createElement( settings.notePreviewOnHover ? 'a' : 'div' )
      if ( 'href' in eventContainer ) {
        eventContainer.addClass( 'internal-link' )
        eventContainer.href = item.path
      }

      eventContainer.setText( item.content )

      return eventContainer
    }
  }


  timelineDiv.setAttribute('class', 'timeline-vis')
  // 1️⃣ 实例化 timeline
  const timeline = new Timeline(timelineDiv, items, groupDataSet, options);

  const controls = document.createElement('div');
  controls.className = 'tl-controls';
  el.prepend(controls);

  // 2️⃣ 绑定 subgroup 切换按钮（你已有的）
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = '隐藏 subgroup';
  toggleBtn.className = 'tl-subgroup-toggle';
  let showSub = true;
  toggleBtn.addEventListener('click', () => {
    showSub = !showSub;
    toggleBtn.textContent = showSub ? '隐藏 subgroup' : '顯示 subgroup';
    timeline.setOptions({ stackSubgroups: showSub });
  });
  controls.appendChild(toggleBtn);

  // 3️⃣ 绑定 group 切换按钮 + 下拉菜单
  const groupBtn = document.createElement('button');
  const groupMenu = document.createElement('div');
  groupBtn.textContent = 'Groups';
  groupBtn.className = 'tl-group-toggle-btn';
  groupMenu.className = 'tl-group-menu';
  groupMenu.style.display = 'none';

  // 把按钮和菜单先插入
  controls.appendChild(groupBtn);
  controls.appendChild(groupMenu);

  // 生成每个 group 的 checkbox
  visibleGroupArray.forEach(g => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.addEventListener('change', () => {
      groupDataSet.update({ id: g.id, visible: cb.checked });
    });
    label.append(cb, document.createTextNode(g.content || 'Default'));
    groupMenu.appendChild(label);
  });

  // 定义一个处理外部点击的函数
  const handleClickOutsideGroupMenu = (event: MouseEvent) => {
    // 检查点击事件的目标是否在 groupMenu 内部，或者是否是 groupBtn 本身
    // 如果 groupMenu 可见，并且点击的不是 groupMenu 也不是 groupBtn
    if (
      groupMenu.style.display === 'block' &&
      !groupMenu.contains(event.target as Node) &&
      event.target !== groupBtn && // 确保点击的不是按钮本身
      !groupBtn.contains(event.target as Node) // 进一步确保点击的不是按钮的子元素 (如果按钮内有图标等)
    ) {
      groupMenu.style.display = 'none';
      // 一旦关闭，就移除 document 上的监听器
      document.removeEventListener('click', handleClickOutsideGroupMenu, true); // 注意这里要用 true (捕获阶段)
    }
  };

  // 按钮切换下拉的逻辑
  groupBtn.addEventListener('click', (event) => {
    // 阻止事件冒泡，这样当 document 监听到点击事件时，不会立即关闭刚打开的菜单
    event.stopPropagation();

    const isMenuVisible = groupMenu.style.display === 'block';
    if (isMenuVisible) {
      groupMenu.style.display = 'none';
      // 移除 document 上的监听器
      document.removeEventListener('click', handleClickOutsideGroupMenu, true);
    } else {
      groupMenu.style.display = 'block';
      // 菜单打开时，在 document 上添加监听器，使用捕获阶段可以更早地处理点击
      // 确保在下一个事件循环中添加，或者确保此处的点击事件不会立即触发 handleClickOutsideGroupMenu
      // event.stopPropagation() 已经处理了这个问题
      document.addEventListener('click', handleClickOutsideGroupMenu, true);
    }
  });

  // 4️⃣ 最后挂载 timelineDiv
  el.appendChild(timelineDiv);



  const arrows = makeArrowsArray( items )

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const myArrows = new Arrow( timeline, arrows )

  // these are probably non-performant but it works so ¯\_(ツ)_/¯
  // dynamically add and remove a "special" class on hover
  // cannot use standard :hover styling due to the structure
  // of the timeline being so broken up across elements. This
  // ensures that all elements related to an event are highlighted.
  timeline.on( 'itemover', ( props ) => {
    const event = items.get( props.item ) as unknown as EventItem
    const newClass = event.className + ' runtime-hover'
    document.documentElement.style.setProperty( '--hoverHighlightColor', event._event?.color ?? 'white' )
    const timelineItem = buildCombinedTimelineDataObject( event, { className: newClass })
    items.updateOnly( [timelineItem] )

    // return () => {
    //   timeline.off( 'itemover' )
    // }
  })

  timeline.on( 'itemout', ( props ) => {
    const event = items.get( props.item ) as unknown as EventItem
    const newClass = event.className.split( ' runtime-hover' )[0]
    const timelineItem = buildCombinedTimelineDataObject( event, { className: newClass })
    items.updateOnly( [timelineItem] )

    // return () => {
    //   timeline.off( 'itemout' )
    // }
  })

  // Replace the selected tags with the timeline html
  el.appendChild( timelineDiv )
}
