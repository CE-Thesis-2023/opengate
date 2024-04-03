import axios from 'axios';
import { route } from 'preact-router';
import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { useApiHost } from '../api';
import ActivityIndicator from '../components/ActivityIndicator';
import Button from '../components/Button';
import Calendar from '../components/Calendar';
import Dialog from '../components/Dialog';
import Heading from '../components/Heading';
import Menu, { MenuItem } from '../components/Menu';
import MultiSelect from '../components/MultiSelect';
import { Tabs, TextTab } from '../components/Tabs';
import TimeAgo from '../components/TimeAgo';
import Timepicker from '../components/TimePicker';
import TimelineEventOverlay from '../components/TimelineEventOverlay';
import TimelineSummary from '../components/TimelineSummary';
import VideoPlayer from '../components/VideoPlayer';
import { About } from '../icons/About';
import CalendarIcon from '../icons/Calendar';
import { Camera } from '../icons/Camera';
import { Clip } from '../icons/Clip';
import { Clock } from '../icons/Clock';
import { Delete } from '../icons/Delete';
import { Download } from '../icons/Download';
import MenuIcon from '../icons/Menu';
import { MenuOpen } from '../icons/MenuOpen';
import { Score } from '../icons/Score';
import { Snapshot } from '../icons/Snapshot';
import { StarRecording } from '../icons/StarRecording';
import { Zone } from '../icons/Zone';
import { formatUnixTimestampToDateTime, getDurationFromTimestamps } from '../utils/dateUtil';

const API_LIMIT = 25;

const daysAgo = (num) => {
  let date = new Date();
  date.setDate(date.getDate() - num);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 1000;
};

const monthsAgo = (num) => {
  let date = new Date();
  date.setMonth(date.getMonth() - num);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 1000;
};

export default function Events({ path, ...props }) {
  const apiHost = useApiHost();
  const { data: config } = useSWR('config');
  const timezone = useMemo(() => config?.ui?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, [config]);
  const [searchParams, setSearchParams] = useState({
    before: null,
    after: null,
    cameras: props.cameras ?? 'all',
    labels: props.labels ?? 'all',
    zones: props.zones ?? 'all',
    sub_labels: props.sub_labels ?? 'all',
    time_range: '00:00,24:00',
    timezone,
    favorites: props.favorites ?? 0,
    is_submitted: props.is_submitted ?? -1,
    event: props.event,
  });
  const [state, setState] = useState({
    showDownloadMenu: false,
    showDatePicker: false,
    showCalendar: false,
  });
  const [viewEvent, setViewEvent] = useState(props.event);
  const [eventOverlay, setEventOverlay] = useState();
  const [downloadEvent, setDownloadEvent] = useState({
    id: null,
    label: null,
    box: null,
    has_clip: false,
    has_snapshot: false,
    end_time: null,
  });
  const [deleteFavoriteState, setDeleteFavoriteState] = useState({
    deletingFavoriteEventId: null,
    showDeleteFavorite: false,
  });

  const [showInProgress, setShowInProgress] = useState((props.event || props.cameras || props.labels) == null);

  const eventsFetcher = useCallback(
    (path, params) => {
      if (searchParams.event) {
        path = `${path}/${searchParams.event}`;
        return axios.get(path).then((res) => [res.data]);
      }
      params = { ...params, in_progress: 0, include_thumbnails: 0, limit: API_LIMIT };
      return axios.get(path, { params }).then((res) => res.data);
    },
    [searchParams]
  );

  const getKey = useCallback(
    (index, prevData) => {
      if (index > 0) {
        const lastDate = prevData[prevData.length - 1].start_time;
        const pagedParams = { ...searchParams, before: lastDate };
        return ['events', pagedParams];
      }

      return ['events', searchParams];
    },
    [searchParams]
  );

  const { data: ongoingEvents, mutate: refreshOngoingEvents } = useSWR([
    'events',
    { in_progress: 1, include_thumbnails: 0 },
  ]);
  const {
    data: eventPages,
    mutate: refreshEvents,
    size,
    setSize,
    isValidating,
  } = useSWRInfinite(getKey, eventsFetcher);
  const mutate = () => {
    refreshEvents();
    refreshOngoingEvents();
  };

  const { data: allLabels } = useSWR(['labels']);
  const { data: allSubLabels } = useSWR(['sub_labels', { split_joined: 1 }]);

  const filterValues = useMemo(
    () => ({
      cameras: Object.keys(config?.cameras || {}),
      zones: [
        ...Object.values(config?.cameras || {})
          .reduce((memo, camera) => {
            memo = memo.concat(Object.keys(camera?.zones || {}));
            return memo;
          }, [])
          .filter((value, i, self) => self.indexOf(value) === i),
        'None',
      ],
      labels: Object.values(allLabels || {}),
      sub_labels: (allSubLabels || []).length > 0 ? [...Object.values(allSubLabels), 'None'] : [],
    }),
    [config, allLabels, allSubLabels]
  );

  const onSave = async (e, eventId, save) => {
    e.stopPropagation();
    let response;
    if (save) {
      response = await axios.post(`events/${eventId}/retain`);
    } else {
      response = await axios.delete(`events/${eventId}/retain`);
    }
    if (response.status === 200) {
      mutate();
    }
  };

  const onDelete = async (e, eventId, saved) => {
    e.stopPropagation();

    if (saved) {
      setDeleteFavoriteState({ deletingFavoriteEventId: eventId, showDeleteFavorite: true });
    } else {
      const response = await axios.delete(`events/${eventId}`);
      if (response.status === 200) {
        mutate();
      }
    }
  };

  const onToggleNamedFilter = (name, item) => {
    let items;

    if (searchParams[name] == 'all') {
      const currentItems = Array.from(filterValues[name]);

      // don't remove all if only one option
      if (currentItems.length > 1) {
        currentItems.splice(currentItems.indexOf(item), 1);
        items = currentItems.join(',');
      } else {
        items = ['all'];
      }
    } else {
      let currentItems = searchParams[name].length > 0 ? searchParams[name].split(',') : [];

      if (currentItems.includes(item)) {
        // don't remove the last item in the filter list
        if (currentItems.length > 1) {
          currentItems.splice(currentItems.indexOf(item), 1);
        }

        items = currentItems.join(',');
      } else if (currentItems.length + 1 == filterValues[name].length) {
        items = ['all'];
      } else {
        currentItems.push(item);
        items = currentItems.join(',');
      }
    }

    onFilter(name, items);
  };

  const onEventFrameSelected = (event, frame, seekSeconds) => {
    if (this.player) {
      this.player.pause();
      this.player.currentTime(seekSeconds);
      setEventOverlay(frame);
    }
  };

  const datePicker = useRef();

  const downloadButton = useRef();

  const onDownloadClick = (e, event) => {
    e.stopPropagation();
    setDownloadEvent((_prev) => ({
      id: event.id,
      box: event?.data?.box || event.box,
      label: event.label,
      has_clip: event.has_clip,
      has_snapshot: event.has_snapshot,
      end_time: event.end_time,
    }));
    downloadButton.current = e.target;
    setState({ ...state, showDownloadMenu: true });
  };

  const handleSelectDateRange = useCallback(
    (dates) => {
      setShowInProgress(false);
      setSearchParams({ ...searchParams, before: dates.before, after: dates.after });
      setState({ ...state, showDatePicker: false });
    },
    [searchParams, setSearchParams, state, setState]
  );

  const handleSelectTimeRange = useCallback(
    (timeRange) => {
      setSearchParams({ ...searchParams, time_range: timeRange });
    },
    [searchParams]
  );

  const onFilter = useCallback(
    (name, value) => {
      setShowInProgress(false);
      const updatedParams = { ...searchParams, [name]: value };
      setSearchParams(updatedParams);
      const queryString = Object.keys(updatedParams)
        .map((key) => {
          if (updatedParams[key] && updatedParams[key] != 'all') {
            return `${key}=${updatedParams[key]}`;
          }
          return null;
        })
        .filter((val) => val)
        .join('&');
      route(`${path}?${queryString}`);
    },
    [path, searchParams, setSearchParams]
  );

  const isDone = (eventPages?.[eventPages.length - 1]?.length ?? 0) < API_LIMIT;

  // hooks for infinite scroll
  const observer = useRef();
  const lastEventRef = useCallback(
    (node) => {
      if (isValidating) return;
      if (observer.current) observer.current.disconnect();
      try {
        observer.current = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting && !isDone) {
            setSize(size + 1);
          }
        });
        if (node) observer.current.observe(node);
      } catch (e) {
        // no op
      }
    },
    [size, setSize, isValidating, isDone]
  );

  return (
    <div className="space-y-4 p-2 px-4 w-full">
      <Heading>Events</Heading>
      <div className="flex flex-wrap gap-2 items-center">
        <MultiSelect
          className="basis-1/5 cursor-pointer rounded dark:bg-slate-800"
          title="Cameras"
          options={filterValues.cameras}
          selection={searchParams.cameras}
          onToggle={(item) => onToggleNamedFilter('cameras', item)}
          onShowAll={() => onFilter('cameras', ['all'])}
          onSelectSingle={(item) => onFilter('cameras', item)}
        />
        <MultiSelect
          className="basis-1/5 cursor-pointer rounded dark:bg-slate-800"
          title="Labels"
          options={filterValues.labels}
          selection={searchParams.labels}
          onToggle={(item) => onToggleNamedFilter('labels', item)}
          onShowAll={() => onFilter('labels', ['all'])}
          onSelectSingle={(item) => onFilter('labels', item)}
        />
        <MultiSelect
          className="basis-1/5 cursor-pointer rounded dark:bg-slate-800"
          title="Zones"
          options={filterValues.zones}
          selection={searchParams.zones}
          onToggle={(item) => onToggleNamedFilter('zones', item)}
          onShowAll={() => onFilter('zones', ['all'])}
          onSelectSingle={(item) => onFilter('zones', item)}
        />
        {filterValues.sub_labels.length > 0 && (
          <MultiSelect
            className="basis-1/5 cursor-pointer rounded dark:bg-slate-800"
            title="Sub Labels"
            options={filterValues.sub_labels}
            selection={searchParams.sub_labels}
            onToggle={(item) => onToggleNamedFilter('sub_labels', item)}
            onShowAll={() => onFilter('sub_labels', ['all'])}
            onSelectSingle={(item) => onFilter('sub_labels', item)}
          />
        )}
        {searchParams.event && (
          <Button className="ml-2" onClick={() => onFilter('event', null)} type="text">
            View All
          </Button>
        )}

        <div className="ml-auto flex">
          <StarRecording
            className="h-10 w-10 text-yellow-300 cursor-pointer ml-auto"
            onClick={() => onFilter('favorites', searchParams.favorites ? 0 : 1)}
            fill={searchParams.favorites == 1 ? 'currentColor' : 'none'}
          />
        </div>

        <div ref={datePicker} className="ml-right">
          <CalendarIcon
            className="h-8 w-8 cursor-pointer"
            onClick={() => setState({ ...state, showDatePicker: true })}
          />
        </div>
      </div>
      {state.showDownloadMenu && (
        <Menu onDismiss={() => setState({ ...state, showDownloadMenu: false })} relativeTo={downloadButton}>
          {downloadEvent.has_snapshot && (
            <MenuItem
              icon={Snapshot}
              label="Download Snapshot"
              value="snapshot"
              href={`${apiHost}api/events/${downloadEvent.id}/snapshot.jpg?download=true`}
              download
            />
          )}
          {downloadEvent.has_clip && (
            <MenuItem
              icon={Clip}
              label="Download Clip"
              value="clip"
              href={`${apiHost}api/events/${downloadEvent.id}/clip.mp4?download=true`}
              download
            />
          )}
        </Menu>
      )}
      {state.showDatePicker && (
        <Menu
          className="rounded-t-none"
          onDismiss={() => setState({ ...state, setShowDatePicker: false })}
          relativeTo={datePicker}
        >
          <MenuItem label="All" value={{ before: null, after: null }} onSelect={handleSelectDateRange} />
          <MenuItem label="Today" value={{ before: null, after: daysAgo(0) }} onSelect={handleSelectDateRange} />
          <MenuItem
            label="Yesterday"
            value={{ before: daysAgo(0), after: daysAgo(1) }}
            onSelect={handleSelectDateRange}
          />
          <MenuItem label="Last 7 Days" value={{ before: null, after: daysAgo(7) }} onSelect={handleSelectDateRange} />
          <MenuItem label="This Month" value={{ before: null, after: monthsAgo(0) }} onSelect={handleSelectDateRange} />
          <MenuItem
            label="Last Month"
            value={{ before: monthsAgo(0), after: monthsAgo(1) }}
            onSelect={handleSelectDateRange}
          />
          <MenuItem
            label="Custom Range"
            value="custom"
            onSelect={() => {
              setState({ ...state, showCalendar: true, showDatePicker: false });
            }}
          />
        </Menu>
      )}

      {state.showCalendar && (
        <span>
          <Menu
            className="rounded-t-none"
            onDismiss={() => setState({ ...state, showCalendar: false })}
            relativeTo={datePicker}
          >
            <Calendar
              onChange={handleSelectDateRange}
              dateRange={{ before: searchParams.before * 1000 || null, after: searchParams.after * 1000 || null }}
              close={() => setState({ ...state, showCalendar: false })}
            >
              <Timepicker timeRange={searchParams.time_range} onChange={handleSelectTimeRange} />
            </Calendar>
          </Menu>
        </span>
      )}
      {deleteFavoriteState.showDeleteFavorite && (
        <Dialog>
          <div className="p-4">
            <Heading size="lg">Delete Saved Event?</Heading>
            <p className="mb-2">Confirm deletion of saved event.</p>
          </div>
          <div className="p-2 flex justify-start flex-row-reverse space-x-2">
            <Button
              className="ml-2"
              onClick={() => setDeleteFavoriteState({ ...state, showDeleteFavorite: false })}
              type="text"
            >
              Cancel
            </Button>
            <Button
              className="ml-2"
              color="red"
              onClick={(e) => {
                setDeleteFavoriteState({ ...state, showDeleteFavorite: false });
                onDelete(e, deleteFavoriteState.deletingFavoriteEventId, false);
              }}
              type="text"
            >
              Delete
            </Button>
          </div>
        </Dialog>
      )}
      <div className="space-y-2">
        {ongoingEvents ? (
          <div>
            <div className="flex">
              <Heading className="py-4" size="sm">
                Ongoing Events
              </Heading>
              <Button
                className="rounded-full"
                type="text"
                color="gray"
                aria-label="Events for currently tracked objects. Recordings are only saved based on your retain settings. See the recording docs for more info."
              >
                <About className="w-5" />
              </Button>
              <Button
                className="rounded-full ml-auto"
                type="iconOnly"
                color="blue"
                onClick={() => setShowInProgress(!showInProgress)}
              >
                {showInProgress ? <MenuOpen className="w-6" /> : <MenuIcon className="w-6" />}
              </Button>
            </div>
            {showInProgress &&
              ongoingEvents.map((event, _) => {
                return (
                  <Event
                    className="my-2"
                    key={event.id}
                    config={config}
                    event={event}
                    eventOverlay={eventOverlay}
                    viewEvent={viewEvent}
                    setViewEvent={setViewEvent}
                    onEventFrameSelected={onEventFrameSelected}
                    onDelete={onDelete}
                    onDispose={() => {
                      this.player = null;
                    }}
                    onDownloadClick={onDownloadClick}
                    onReady={(player) => {
                      this.player = player;
                      this.player.on('playing', () => {
                        setEventOverlay(undefined);
                      });
                    }}
                    onSave={onSave}
                  />
                );
              })}
          </div>
        ) : null}
        <Heading className="py-4" size="sm">
          Past Events
        </Heading>
        {eventPages ? (
          eventPages.map((page, i) => {
            const lastPage = eventPages.length === i + 1;
            return page.map((event, j) => {
              const lastEvent = lastPage && page.length === j + 1;
              return (
                <Event
                  key={event.id}
                  config={config}
                  event={event}
                  eventOverlay={eventOverlay}
                  viewEvent={viewEvent}
                  setViewEvent={setViewEvent}
                  lastEvent={lastEvent}
                  lastEventRef={lastEventRef}
                  onEventFrameSelected={onEventFrameSelected}
                  onDelete={onDelete}
                  onDispose={() => {
                    this.player = null;
                  }}
                  onDownloadClick={onDownloadClick}
                  onReady={(player) => {
                    this.player = player;
                    this.player.on('playing', () => {
                      setEventOverlay(undefined);
                    });
                  }}
                  onSave={onSave}
                />
              );
            });
          })
        ) : (
          <ActivityIndicator />
        )}
      </div>
      <div>{isDone ? null : <ActivityIndicator />}</div>
    </div>
  );
}

function Event({
  className = '',
  config,
  event,
  eventDetailType,
  eventOverlay,
  viewEvent,
  setViewEvent,
  lastEvent,
  lastEventRef,
  handleEventDetailTabChange,
  onEventFrameSelected,
  onDelete,
  onDispose,
  onDownloadClick,
  onReady,
  onSave,
}) {
  const apiHost = useApiHost();

  return (
    <div className={className}>
      <div
        ref={lastEvent ? lastEventRef : false}
        className="flex bg-slate-100 dark:bg-slate-800 rounded cursor-pointer min-w-[330px]"
        onClick={() => (viewEvent === event.id ? setViewEvent(null) : setViewEvent(event.id))}
      >
        <div
          className="relative rounded-l flex-initial min-w-[125px] h-[125px] bg-contain bg-no-repeat bg-center"
          style={{
            'background-image': `url(${apiHost}api/events/${event.id}/thumbnail.jpg)`,
          }}
        >
          <StarRecording
            className="h-6 w-6 text-yellow-300 absolute top-1 right-1 cursor-pointer"
            onClick={(e) => onSave(e, event.id, !event.retain_indefinitely)}
            fill={event.retain_indefinitely ? 'currentColor' : 'none'}
          />
          {event.end_time ? null : (
            <div className="bg-slate-300 dark:bg-slate-700 absolute bottom-0 text-center w-full uppercase text-sm rounded-bl">
              In progress
            </div>
          )}
        </div>
        <div className="m-2 flex grow">
          <div className="flex flex-col grow">
            <div className="capitalize text-lg font-bold">
              {event.label.replaceAll('_', ' ')}
              {event.sub_label ? `: ${event.sub_label.replaceAll('_', ' ')}` : null}
            </div>

            <div className="text-sm flex">
              <Clock className="h-5 w-5 mr-2 inline" />
              {formatUnixTimestampToDateTime(event.start_time, { ...config.ui })}
              <div className="hidden sm:inline">
                <span className="m-1">-</span>
                <TimeAgo time={event.start_time * 1000} dense />
              </div>
              <div className="hidden sm:inline">
                <span className="m-1" />( {getDurationFromTimestamps(event.start_time, event.end_time)} )
              </div>
            </div>
            <div className="capitalize text-sm flex align-center mt-1">
              <Camera className="h-5 w-5 mr-2 inline" />
              {event.camera.replaceAll('_', ' ')}
            </div>
            {event.zones.length ? (
              <div className="capitalize  text-sm flex align-center">
                <Zone className="w-5 h-5 mr-2 inline" />
                {event.zones.join(', ').replaceAll('_', ' ')}
              </div>
            ) : null}
            <div className="capitalize  text-sm flex align-center">
              <Score className="w-5 h-5 mr-2 inline" />
              {(event?.data?.top_score || event.top_score || 0) == 0
                ? null
                : `${event.label}: ${((event?.data?.top_score || event.top_score) * 100).toFixed(0)}%`}
              {(event?.data?.sub_label_score || 0) == 0
                ? null
                : `, ${event.sub_label}: ${(event?.data?.sub_label_score * 100).toFixed(0)}%`}
            </div>
          </div>
          <div class="flex flex-col">
            <Delete
              className="h-6 w-6 cursor-pointer"
              stroke="#f87171"
              onClick={(e) => onDelete(e, event.id, event.retain_indefinitely)}
            />

            <Download
              className="h-6 w-6 mt-auto"
              stroke={event.has_clip || event.has_snapshot ? '#3b82f6' : '#cbd5e1'}
              onClick={(e) => onDownloadClick(e, event)}
            />
          </div>
        </div>
      </div>
      {viewEvent !== event.id ? null : (
        <div className="space-y-4">
          <div className="mx-auto max-w-7xl">
            <div className="flex justify-center w-full py-2">
              <Tabs
                selectedIndex={event.has_clip && eventDetailType == 'clip' ? 0 : 1}
                onChange={handleEventDetailTabChange}
                className="justify"
              >
                <TextTab text="Clip" disabled={!event.has_clip} />
                <TextTab text={event.has_snapshot ? 'Snapshot' : 'Thumbnail'} />
              </Tabs>
            </div>

            <div>
              {eventDetailType == 'clip' && event.has_clip ? (
                <div>
                  <TimelineSummary
                    event={event}
                    onFrameSelected={(frame, seekSeconds) => onEventFrameSelected(event, frame, seekSeconds)}
                  />
                  <div>
                    <VideoPlayer
                      options={{
                        preload: 'auto',
                        autoplay: true,
                        sources: [
                          {
                            src: `${apiHost}vod/event/${event.id}/master.m3u8`,
                            type: 'application/vnd.apple.mpegurl',
                          },
                        ],
                      }}
                      seekOptions={{ forward: 10, backward: 5 }}
                      onReady={onReady}
                      onDispose={onDispose}
                    >
                      {eventOverlay ? (
                        <TimelineEventOverlay eventOverlay={eventOverlay} cameraConfig={config.cameras[event.camera]} />
                      ) : null}
                    </VideoPlayer>
                  </div>
                </div>
              ) : null}

              {eventDetailType == 'image' || !event.has_clip ? (
                <div className="flex justify-center">
                  <img
                    className="flex-grow-0"
                    src={
                      event.has_snapshot
                        ? `${apiHost}api/events/${event.id}/snapshot.jpg?bbox=1`
                        : `${apiHost}api/events/${event.id}/thumbnail.jpg`
                    }
                    alt={`${event.label} at ${((event?.data?.top_score || event.top_score) * 100).toFixed(
                      0
                    )}% confidence`}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
