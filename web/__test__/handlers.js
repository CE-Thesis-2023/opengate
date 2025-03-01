import { rest } from 'msw';
// import { API_HOST } from '../src/env';

export const handlers = [
  rest.get(`api/config`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        mqtt: {
          stats_interval: 60,
        },
        service: {
          version: '0.8.3',
        },
        cameras: {
          front: {
            name: 'front',
            objects: { track: ['taco', 'cat', 'dog'] },
            audio: { enabled: false, enabled_in_config: false },
            record: { enabled: true, enabled_in_config: true },
            detect: { width: 1280, height: 720 },
            snapshots: {},
            restream: { enabled: true, jsmpeg: { height: 720 } },
            ui: { dashboard: true, order: 0 },
          },
          side: {
            name: 'side',
            objects: { track: ['taco', 'cat', 'dog'] },
            audio: { enabled: false, enabled_in_config: false },
            record: { enabled: false, enabled_in_config: true },
            detect: { width: 1280, height: 720 },
            snapshots: {},
            restream: { enabled: true, jsmpeg: { height: 720 } },
            ui: { dashboard: true, order: 1 },
          },
        },
      })
    );
  }),
  rest.get(`api/stats`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        cpu_usages: {
          74: { cpu: 6, mem: 6 },
          64: { cpu: 5, mem: 5 },
          54: { cpu: 4, mem: 4 },
          71: { cpu: 3, mem: 3 },
          60: { cpu: 2, mem: 2 },
          72: { cpu: 1, mem: 1 },
        },
        detection_fps: 0.0,
        detectors: { coral: { detection_start: 0.0, inference_speed: 8.94, pid: 52 } },
        front: {
          camera_fps: 5.0,
          capture_pid: 64,
          detection_fps: 0.0,
          pid: 54,
          process_fps: 0.0,
          skipped_fps: 0.0,
          ffmpeg_pid: 72,
        },
        side: {
          camera_fps: 6.9,
          capture_pid: 71,
          detection_fps: 0.0,
          pid: 60,
          process_fps: 0.0,
          skipped_fps: 0.0,
          ffmpeg_pid: 74,
        },
        service: { uptime: 34812, version: '0.8.1-d376f6b' },
      })
    );
  }),
  rest.get(`api/events`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(
        new Array(12).fill(null).map((v, i) => ({
          end_time: 1613257337 + i,
          has_clip: true,
          has_snapshot: true,
          id: i,
          label: 'person',
          start_time: 1613257326 + i,
          top_score: Math.random(),
          zones: ['front_patio'],
          thumbnail: '/9j/4aa...',
          camera: 'camera_name',
        }))
      )
    );
  }),
  rest.get(`api/sub_labels`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(['one', 'two']));
  }),
  rest.get(`api/labels`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(['person', 'car']));
  }),
  rest.get(`api/go2rtc`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        config_path: '/dev/shm/go2rtc.yaml',
        host: 'opengate.yourdomain.local',
        rtsp: { listen: '0.0.0.0:8554', default_query: 'mp4', PacketSize: 0 },
        version: '1.7.1',
      })
    );
  }),
];
