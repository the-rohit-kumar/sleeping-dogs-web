/**
 * audio-engine.ts
 * Real-time Web Audio API pipeline for Sleeping Dogs reconstruction.
 * Streams authentic base-game audio decoded directly from Audiokinetic Wwise PCK packages
 * (SFX.pck and English(US).pck) via the local asset bridge.
 *
 * Implements:
 *  - Web Audio Context lifecycle management
 *  - Multi-track simultaneous playback (ambient loop, engine loop, one-shot SFX)
 *  - Positional 3D spatial audio (PannerNode) linked to SceneNode 3D positions
 *  - Real-time frequency spectrum analysis (AnalyserNode)
 *  - Master gain and individual bus attenuation
 *
 * ZERO synthetic assets: All sound waves originate from the base game.
 */

import { ASSET_BRIDGE_BASE } from './asset-loader';

export interface AudioTrackInfo {
  id: string;
  name: string;
  source: string; // Archive & Stream ID
  description: string;
  sampleRate: number;
  channels: number;
  isLoop: boolean;
  spatialPosition?: [number, number, number];
}

export const AUTHENTIC_TRACKS: Record<string, AudioTrackInfo> = {
  hk_ambience: {
    id: 'hk_ambience',
    name: 'Hong Kong Urban Ambience',
    source: 'SFX.pck (Stream 129282 @ 0x9251ad9)',
    description: 'City street tone, distant traffic, and ambient Hong Kong atmosphere',
    sampleRate: 48000,
    channels: 1,
    isLoop: true
  },
  vehicle_engine: {
    id: 'vehicle_engine',
    name: 'Vehicle Engine Idle & Rev',
    source: 'SFX.pck (Stream 24476605 @ 0x0d528ab2)',
    description: 'Authentic 4-cylinder sedan engine combustion and exhaust loop',
    sampleRate: 48000,
    channels: 1,
    isLoop: true,
    spatialPosition: [1.8, 0.35, 0.0] // Attached to vehicle node
  },
  combat_strike: {
    id: 'combat_strike',
    name: 'Martial Arts Combat Strike',
    source: 'SFX.pck (Stream 42696416 @ 0x104d1f2f)',
    description: 'Authentic martial arts punch impact and whoosh sound effect',
    sampleRate: 48000,
    channels: 1,
    isLoop: false,
    spatialPosition: [-2.2, 1.2, 1.2] // Attached to pedestrian/combatant
  },
  counter_impact: {
    id: 'counter_impact',
    name: 'Martial Arts Counter Bone Crunch',
    source: 'SFX.pck (Stream 36466185 @ 0x0f01c9e7)',
    description: 'Authentic Sleeping Dogs bone crunch counter reversal impact',
    sampleRate: 48000,
    channels: 1,
    isLoop: false,
    spatialPosition: [-2.2, 1.2, 1.2]
  },
  vehicle_horn: {
    id: 'vehicle_horn',
    name: 'Vehicle Horn / Tire Screech',
    source: 'SFX.pck (Stream 16943907 @ 0x0ba87b9b)',
    description: 'Authentic Hong Kong vehicle traffic horn and tire screech',
    sampleRate: 48000,
    channels: 1,
    isLoop: false,
    spatialPosition: [1.8, 0.35, 0.0]
  },
  radio_boosey: {
    id: 'radio_boosey',
    name: 'Boosey & Hawkes 98.4 FM',
    source: 'SFX.pck (Stream 11795260 @ 0x0adb78f3)',
    description: 'Authentic in-game classical radio station broadcast',
    sampleRate: 48000,
    channels: 2,
    isLoop: true
  },
  radio_kerrang: {
    id: 'radio_kerrang',
    name: 'Kerrang! Radio 105.2 FM',
    source: 'SFX.pck (Stream 42868061 @ 0x104d5775)',
    description: 'Authentic in-game high-octane rock radio station broadcast',
    sampleRate: 48000,
    channels: 2,
    isLoop: true
  },
  radio_softly: {
    id: 'radio_softly',
    name: 'Softly FM Hong Kong Lounge',
    source: 'SFX.pck (Stream 10361450 @ 0x0a9d941e)',
    description: 'Authentic in-game smooth lounge & Cantopop radio station broadcast',
    sampleRate: 48000,
    channels: 2,
    isLoop: true
  },
  hk_dialogue: {
    id: 'hk_dialogue',
    name: 'Hong Kong Pedestrian Voice',
    source: 'English(US).pck (Stream 100753 @ 0x00431f8c)',
    description: 'Authentic Cantonese/English pedestrian voice line',
    sampleRate: 44100,
    channels: 1,
    isLoop: false,
    spatialPosition: [-2.2, 1.6, 1.2] // Attached to pedestrian head
  },
  env_takedown: {
    id: 'env_takedown',
    name: 'Environmental Takedown Impact',
    source: 'SFX.pck (Stream 4784603 @ 0x09e7f465)',
    description: 'Signature Sleeping Dogs environmental slam and smash sound',
    sampleRate: 48000,
    channels: 1,
    isLoop: false
  },
  police_siren: {
    id: 'police_siren',
    name: 'Hong Kong Police Pursuit Siren',
    source: 'SFX.pck (Stream 2667881 @ 0x0985d257)',
    description: 'Hong Kong Police Department cruiser pursuit siren & radio dispatch',
    sampleRate: 48000,
    channels: 2,
    isLoop: false
  },
  mission_fanfare: {
    id: 'mission_fanfare',
    name: 'Mission Accomplished Fanfare',
    source: 'SFX.pck (Stream 2530870 @ 0x0984a0ab)',
    description: 'Authentic orchestral brass fanfare for mission success',
    sampleRate: 44100,
    channels: 2,
    isLoop: false
  },
  triad_brawl_shout: {
    id: 'triad_brawl_shout',
    name: 'Triad Brawler Shouts & Atmosphere',
    source: 'SFX.pck (Stream 20896152 @ 0x0ce55550)',
    description: '18K and Sun On Yee triad brawlers shouting and fight clamor',
    sampleRate: 48000,
    channels: 1,
    isLoop: false
  },
  raymond_interrogate: {
    id: 'raymond_interrogate',
    name: 'Inspector Raymond Mak Interrogation',
    source: 'English(US).pck (Stream 346748889 @ 0x0504b727)',
    description: 'Raymond Mak interrogates Wei Shen in HKPD Central interrogation room',
    sampleRate: 44100,
    channels: 1,
    isLoop: false
  },
  pendrew_briefing: {
    id: 'pendrew_briefing',
    name: 'Superintendent Pendrew Briefing',
    source: 'English(US).pck (Stream 432101378 @ 0x0636bfa5)',
    description: 'Thomas Pendrew briefs Wei Shen on infiltrating Sun On Yee Triad',
    sampleRate: 48000,
    channels: 1,
    isLoop: false
  },
  jackie_reunion: {
    id: 'jackie_reunion',
    name: 'Jackie Ma Cell Reunion',
    source: 'English(US).pck (Stream 859502205 @ 0x0c03073d)',
    description: 'Jackie Ma reconnects with Wei Shen in police holding cells',
    sampleRate: 44100,
    channels: 1,
    isLoop: false
  },
  winston_shakedown: {
    id: 'winston_shakedown',
    name: 'Winston Chu Extortion Orders',
    source: 'English(US).pck (Stream 1445816605 @ 0x143cebc4)',
    description: 'Winston Chu commands Wei to collect protection from night market vendors',
    sampleRate: 48000,
    channels: 1,
    isLoop: false
  },
  vendor_argument: {
    id: 'vendor_argument',
    name: 'Night Market Vendor Defiance',
    source: 'English(US).pck (Stream 1794261640 @ 0x18fda27b)',
    description: 'Drink vendor refuses extortion payment and invokes Dogeyes',
    sampleRate: 48000,
    channels: 1,
    isLoop: false
  },
  triad_threat: {
    id: 'triad_threat',
    name: 'Dogeyes 18K Ambush Shouts',
    source: 'English(US).pck (Stream 2810582780 @ 0x271235be)',
    description: '18K thugs surround Wei Shen in North Point Night Market alley',
    sampleRate: 48000,
    channels: 1,
    isLoop: false
  },
  ming_flee: {
    id: 'ming_flee',
    name: 'Dirty Ming Night Market Panic',
    source: 'English(US).pck (Stream 345697370 @ 0x04fe5f89)',
    description: 'Dirty Ming panics and bolts through the night market',
    sampleRate: 44100,
    channels: 1,
    isLoop: false
  },
  wei_pursuit: {
    id: 'wei_pursuit',
    name: 'Wei Shen Rooftop Pursuit Demands',
    source: 'English(US).pck (Stream 1192456746 @ 0x10c4870f)',
    description: 'Wei Shen demands Ming halt during the rooftop chase',
    sampleRate: 44100,
    channels: 1,
    isLoop: false
  },
  ming_rooftop_threat: {
    id: 'ming_rooftop_threat',
    name: 'Dirty Ming Rooftop Balcony Ambush',
    source: 'English(US).pck (Stream 716168228 @ 0x09fdad97)',
    description: 'Ming commands knife thugs to throw Wei Shen off the roof',
    sampleRate: 48000,
    channels: 1,
    isLoop: false
  },
  blade_slash: {
    id: 'blade_slash',
    name: 'Triad Blade Slash Impact',
    source: 'SFX.pck (Stream 4785461 @ 0x09e86397)',
    description: 'Authentic weapon blade slash and whoosh impact',
    sampleRate: 48000,
    channels: 1,
    isLoop: false
  },
  knife_stab: {
    id: 'knife_stab',
    name: 'Triad Knife Counter Disarm',
    source: 'SFX.pck (Stream 4786312 @ 0x09e891e2)',
    description: 'Authentic knife deflection and disarm sound effect',
    sampleRate: 48000,
    channels: 1,
    isLoop: false
  }
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private analyser!: AnalyserNode;
  private trackBuffers: Map<string, AudioBuffer> = new Map();
  private activeSources: Map<string, { source: AudioBufferSourceNode; panner?: PannerNode; gain: GainNode }> = new Map();

  public isMuted = false;
  public masterVolume = 0.85;
  public spatialAudioEnabled = true;
  public currentTrackId = 'hk_ambience';
  public isPlaying = false;

  constructor() {
    // AudioContext will be initialized on first user gesture (browser requirement)
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.masterVolume;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Loads and decodes an authentic audio track from the asset bridge
   */
  public async loadTrack(trackId: string): Promise<AudioBuffer> {
    if (this.trackBuffers.has(trackId)) {
      return this.trackBuffers.get(trackId)!;
    }

    const ctx = await this.ensureContext();
    const url = `${ASSET_BRIDGE_BASE}/api/audio/${trackId}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio track ${trackId} from bridge (HTTP ${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    this.trackBuffers.set(trackId, audioBuffer);
    return audioBuffer;
  }

  /**
   * Plays an authentic audio track with optional 3D spatial positioning
   */
  public async playTrack(trackId: string): Promise<void> {
    const ctx = await this.ensureContext();
    this.currentTrackId = trackId;

    // Stop existing playback of this track if running
    this.stopTrack(trackId);

    const buffer = await this.loadTrack(trackId);
    const trackInfo = AUTHENTIC_TRACKS[trackId];

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = trackInfo.isLoop;

    const trackGain = ctx.createGain();
    trackGain.gain.value = 1.0;

    let panner: PannerNode | undefined;
    if (this.spatialAudioEnabled && trackInfo.spatialPosition && ctx.createPanner) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1.5;
      panner.maxDistance = 60.0;
      panner.rolloffFactor = 1.2;
      panner.positionX.value = trackInfo.spatialPosition[0];
      panner.positionY.value = trackInfo.spatialPosition[1];
      panner.positionZ.value = trackInfo.spatialPosition[2];

      source.connect(trackGain);
      trackGain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      source.connect(trackGain);
      trackGain.connect(this.masterGain);
    }

    source.onended = () => {
      if (!trackInfo.isLoop) {
        this.activeSources.delete(trackId);
        if (this.currentTrackId === trackId) {
          this.isPlaying = false;
        }
      }
    };

    source.start(0);
    this.activeSources.set(trackId, { source, panner, gain: trackGain });
    this.isPlaying = true;
  }

  /**
   * Stops an active audio track
   */
  public stopTrack(trackId: string): void {
    const active = this.activeSources.get(trackId);
    if (active) {
      try {
        active.source.stop();
        active.source.disconnect();
      } catch {}
      this.activeSources.delete(trackId);
    }
    if (this.currentTrackId === trackId) {
      this.isPlaying = false;
    }
  }

  /**
   * Stops all active audio streams
   */
  public stopAll(): void {
    for (const [id] of this.activeSources) {
      this.stopTrack(id);
    }
    this.isPlaying = false;
  }

  /**
   * Modulates playback pitch / speed (e.g. vehicle engine RPM)
   */
  public setPlaybackRate(rate: number, trackId?: string): void {
    const id = trackId || this.currentTrackId;
    const active = this.activeSources.get(id);
    if (active && active.source && active.source.playbackRate) {
      active.source.playbackRate.value = Math.max(0.2, Math.min(3.0, rate));
    }
  }

  /**
   * Updates listener position from 3D camera
   */
  public updateListener(camPos: [number, number, number], forward: [number, number, number]): void {
    if (!this.ctx || !this.ctx.listener) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = camPos[0];
      l.positionY.value = camPos[1];
      l.positionZ.value = camPos[2];
      l.forwardX.value = forward[0];
      l.forwardY.value = forward[1];
      l.forwardZ.value = forward[2];
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    }
  }

  /**
   * Sets master volume level (0.0 to 1.0)
   */
  public setVolume(volume: number): void {
    this.masterVolume = Math.max(0.0, Math.min(1.0, volume));
    if (this.masterGain && !this.isMuted) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  /**
   * Toggles master audio mute
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : this.masterVolume;
    }
    return this.isMuted;
  }

  /**
   * Retrieves real-time frequency spectrum data for visualizer
   */
  public getFrequencyData(outArray: Uint8Array): void {
    if (this.analyser && this.isPlaying && !this.isMuted) {
      this.analyser.getByteFrequencyData(outArray as any);
    } else {
      outArray.fill(0);
    }
  }
}
