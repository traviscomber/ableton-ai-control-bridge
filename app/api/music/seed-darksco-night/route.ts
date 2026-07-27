import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET() {
  try {
    // Create Sound Design Profile for DARKSCO Night
    const profileResponse = await supabase
      .from('sound_design_profiles')
      .insert({
        name: 'DARKSCO - Night (Deep Dark Disco)',
        style: 'dark disco funk techno',
        bpm: 120,
        key: 'F minor',
        time_signature: '4/4',
        production_goal:
          'Deep, dark dark disco funk for late-night introspective grooves with hypnotic elements and industrial character',
        mood_keywords: ['mysterious', 'groovy', 'dark', 'hypnotic', 'industrial'],
        instrumentation: [
          'deep bass',
          'tight kick',
          'dark hi-hat',
          'dark snare',
          'dark pad',
          'dark stab',
          'dark arpeggio',
          'dark texture',
        ],
      })
      .select()
      .single();

    if (profileResponse.error) throw profileResponse.error;
    const profile = profileResponse.data;

    // Create Soundbank
    const soundbankResponse = await supabase
      .from('soundbanks')
      .insert({
        profile_id: profile.id,
        name: 'DARKSCO v1.0 - Night',
        version: 1,
        bpm: 120,
        key: 'F minor',
        status: 'stems-uploaded',
        total_stems: 8,
      })
      .select()
      .single();

    if (soundbankResponse.error) throw soundbankResponse.error;
    const soundbank = soundbankResponse.data;

    // Define DARKSCO Night Stems
    const nightStems = [
      {
        soundbank_id: soundbank.id,
        name: 'Deep Bass Line 40Hz',
        instrument_type: 'bass',
        category: 'foundational',
        duration_seconds: 32,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [30, 100],
        dynamics: 'sustain',
        processing: ['dark-tone', 'deep-compression'],
        description:
          'Deep, hypnotic bass at 40Hz with dark character. Ultra-deep foundation perfect for late-night grooves.',
        blob_path: 'stems/darksco-night-001/deep-bass-40hz.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Kick Drum Dark',
        instrument_type: 'drum',
        category: 'percussive',
        duration_seconds: 1.2,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [40, 200],
        dynamics: 'percussive',
        processing: ['dark-eq', 'tight-transient'],
        description:
          'Tight, dark kick drum with industrial precision. Perfect for late-night deep groove and hypnotic feel.',
        blob_path: 'stems/darksco-night-001/kick-drum-dark.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Hi-Hat Analog Dark',
        instrument_type: 'drum',
        category: 'percussive',
        duration_seconds: 8,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [2000, 10000],
        dynamics: 'percussive',
        processing: ['dark-character', 'tight-transient'],
        description:
          'Dark, analog hi-hat with industrial character. 16th-note pattern at 120 BPM, deep late-night feel.',
        blob_path: 'stems/darksco-night-001/hi-hat-analog-dark.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Snare Dark',
        instrument_type: 'drum',
        category: 'percussive',
        duration_seconds: 0.8,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [200, 3000],
        dynamics: 'percussive',
        processing: ['dark-eq', 'tight-compression'],
        description:
          'Tight, dark snare with industrial precision. Perfect for late-night groove and mysterious character.',
        blob_path: 'stems/darksco-night-001/snare-dark.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Dark Pad Synth',
        instrument_type: 'synth',
        category: 'textural',
        duration_seconds: 48,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [100, 2000],
        dynamics: 'sustain',
        processing: ['dark-filter', 'deep-modulation'],
        description:
          'Mysterious, dark pad synth with deep modulation. Creates hypnotic atmosphere perfect for late-night depth.',
        blob_path: 'stems/darksco-night-001/dark-pad-synth.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Stab Synth Dark',
        instrument_type: 'synth',
        category: 'percussive',
        duration_seconds: 2.4,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [200, 3000],
        dynamics: 'percussive',
        processing: ['dark-eq', 'industrial-character'],
        description:
          'Dark, percussive synth stab with industrial character. Perfect for rhythmic punctuation and mystery.',
        blob_path: 'stems/darksco-night-001/stab-synth-dark.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Arpeggio Dark',
        instrument_type: 'synth',
        category: 'textural',
        duration_seconds: 16,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [300, 3000],
        dynamics: 'dynamic',
        processing: ['dark-arpeggio', 'hypnotic-pattern'],
        description:
          'Hypnotic, dark arpeggiated synth with mysterious character. 16th-note pattern adds deep hypnotic movement.',
        blob_path: 'stems/darksco-night-001/arpeggio-dark.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Noise Dark Texture',
        instrument_type: 'fx',
        category: 'textural',
        duration_seconds: 16,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [500, 8000],
        dynamics: 'dynamic',
        processing: ['dark-filtering', 'atmospheric-texture'],
        description:
          'Dark, atmospheric noise texture with filtered character. Creates depth and mystery for late-night production.',
        blob_path: 'stems/darksco-night-001/noise-dark-texture.wav',
        version: 1,
        status: 'processed',
      },
    ];

    // Insert all stems
    const stemsResponse = await supabase
      .from('stems')
      .insert(nightStems)
      .select();

    if (stemsResponse.error) throw stemsResponse.error;
    const stems = stemsResponse.data;

    // Create production-ready clips
    const nightClips = [
      {
        soundbank_id: soundbank.id,
        stem_id: stems[0].id,
        name: 'Deep Bass 32-bar Loop',
        duration_seconds: 32,
        start_point: 0,
        end_point: 32,
        tags: ['loop-ready', 'foundational', 'deep'],
        loop_ready: true,
        tempo_synced: true,
        tempo_bpm: 120,
        version: 1,
      },
      {
        soundbank_id: soundbank.id,
        stem_id: stems[1].id,
        name: 'Kick Single Hit',
        duration_seconds: 1.2,
        start_point: 0,
        end_point: 1.2,
        tags: ['single', 'dark', 'tight'],
        loop_ready: false,
        tempo_synced: true,
        tempo_bpm: 120,
        version: 1,
      },
      {
        soundbank_id: soundbank.id,
        stem_id: stems[2].id,
        name: 'Hi-Hat 2-bar Loop',
        duration_seconds: 8,
        start_point: 0,
        end_point: 8,
        tags: ['loop-ready', 'dark', 'analog'],
        loop_ready: true,
        tempo_synced: true,
        tempo_bpm: 120,
        version: 1,
      },
      {
        soundbank_id: soundbank.id,
        stem_id: stems[4].id,
        name: 'Pad 8-bar Sustain',
        duration_seconds: 32,
        start_point: 0,
        end_point: 32,
        tags: ['sustain', 'dark', 'mysterious'],
        loop_ready: false,
        tempo_synced: false,
        version: 1,
      },
      {
        soundbank_id: soundbank.id,
        stem_id: stems[6].id,
        name: 'Arpeggio Dark Loop',
        duration_seconds: 16,
        start_point: 0,
        end_point: 16,
        tags: ['loop-ready', 'hypnotic', 'dark'],
        loop_ready: true,
        tempo_synced: true,
        tempo_bpm: 120,
        version: 1,
      },
    ];

    const clipsResponse = await supabase
      .from('clips')
      .insert(nightClips)
      .select();

    if (clipsResponse.error) throw clipsResponse.error;

    // Update soundbank status
    await supabase
      .from('soundbanks')
      .update({ status: 'clips-extracted', total_clips: 5 })
      .eq('id', soundbank.id);

    return NextResponse.json(
      {
        success: true,
        message: 'Professional DARKSCO Night soundbank created successfully',
        data: {
          profile,
          soundbank: { ...soundbank, status: 'clips-extracted', total_clips: 5 },
          stems: stems.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.instrument_type,
            duration: s.duration_seconds,
            frequency_range: s.frequency_range,
          })),
          clips: nightClips.map((c) => ({
            id: c.id,
            name: c.name,
            duration: c.duration_seconds,
            loop_ready: c.loop_ready,
          })),
          next_steps: [
            '✓ Sound Design Profile created (Night variant)',
            '✓ Soundbank created with 8 professional stems',
            '✓ 5 production-ready clips extracted',
            '→ Ready for Soundsmith validation',
            '→ Run: POST /api/music/validate-soundbank',
          ],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] DARKSCO Night seed error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create DARKSCO Night soundbank',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
