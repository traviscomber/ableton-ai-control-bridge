import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET() {
  try {
    // Create Sound Design Profile for DARKSCO Daytime
    const profileResponse = await supabase
      .from('sound_design_profiles')
      .insert({
        name: 'DARKSCO - Daytime (Bright Dark Disco)',
        style: 'dark disco funk techno',
        bpm: 124,
        key: 'C major',
        time_signature: '4/4',
        production_goal:
          'Energetic, uplifting dark disco funk for peak-time dancefloor with bright synths and funky grooves',
        mood_keywords: ['playful', 'groovy', 'energetic', 'uplifting', 'funky'],
        instrumentation: [
          'funky bass',
          'kick drum',
          'hi-hat',
          'snare',
          'synth pad',
          'synth stab',
          'arpeggiator',
          'vocal chop',
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
        name: 'DARKSCO v1.0 - Daytime',
        version: 1,
        bpm: 124,
        key: 'C major',
        status: 'stems-uploaded',
        total_stems: 8,
      })
      .select()
      .single();

    if (soundbankResponse.error) throw soundbankResponse.error;
    const soundbank = soundbankResponse.data;

    // Define DARKSCO Daytime Stems with professional specs
    const daytimeStems = [
      {
        soundbank_id: soundbank.id,
        name: 'Funky Bass Line 60Hz',
        instrument_type: 'bass',
        category: 'foundational',
        duration_seconds: 32,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [50, 120],
        dynamics: 'sustain',
        processing: ['saturation', 'slight-compression'],
        description:
          'Bright, uplifting funky bass line at 60Hz with groove pocket perfect for daytime dancefloor. Clean tone with slight saturation for energy.',
        blob_path: 'stems/darksco-daytime-001/funky-bass-60hz.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Kick Drum Tight',
        instrument_type: 'drum',
        category: 'percussive',
        duration_seconds: 1.2,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [40, 300],
        dynamics: 'percussive',
        processing: ['slight-eq', 'tight-transient'],
        description:
          'Punchy, club-ready tight kick drum perfect for daytime sets. Defined attack with quick decay, bright tone for energy.',
        blob_path: 'stems/darksco-daytime-001/kick-drum-tight.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Hi-Hat Bright Loop',
        instrument_type: 'drum',
        category: 'percussive',
        duration_seconds: 8,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [4000, 16000],
        dynamics: 'percussive',
        processing: ['bright-eq', 'crisp-transient'],
        description:
          'Sharp, crisp hi-hat loop with bright character. 16th-note pattern at 124 BPM, perfect for uplifting daytime energy.',
        blob_path: 'stems/darksco-daytime-001/hi-hat-bright-loop.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Clap Snare Crack',
        instrument_type: 'drum',
        category: 'percussive',
        duration_seconds: 0.8,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [200, 8000],
        dynamics: 'percussive',
        processing: ['bright-eq', 'tight-compression'],
        description:
          'Punchy clap/snare with bright crack character. Syncopated placement for rhythmic punctuation and energy.',
        blob_path: 'stems/darksco-daytime-001/clap-snare-crack.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Bright Pad Synth',
        instrument_type: 'synth',
        category: 'textural',
        duration_seconds: 48,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [200, 3000],
        dynamics: 'sustain',
        processing: ['bright-filter', 'subtle-modulation'],
        description:
          'Uplifting, bright pad synth with subtle modulation. Creates atmosphere while maintaining daytime energy and positivity.',
        blob_path: 'stems/darksco-daytime-001/bright-pad-synth.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Stab Synth Bright',
        instrument_type: 'synth',
        category: 'percussive',
        duration_seconds: 2.4,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [300, 4000],
        dynamics: 'percussive',
        processing: ['bright-eq', 'punchy-attack'],
        description:
          'Percussive, bright synth stab with tight attack. Perfect for rhythmic punctuation and syncopated accents.',
        blob_path: 'stems/darksco-daytime-001/stab-synth-bright.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Arpeggiated Synth',
        instrument_type: 'synth',
        category: 'textural',
        duration_seconds: 16,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [500, 5000],
        dynamics: 'dynamic',
        processing: ['arpeggio-pattern', 'bright-tone'],
        description:
          'Groovy arpeggiated synth with bright, funky character. 16th-note pattern adds rhythmic movement and groove.',
        blob_path: 'stems/darksco-daytime-001/arpeggiated-synth.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Vocal Chop Loop',
        instrument_type: 'vocal',
        category: 'textural',
        duration_seconds: 8,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [400, 6000],
        dynamics: 'percussive',
        processing: ['chopped', 'pitched', 'bright-tone'],
        description:
          'Uplifting vocal chops with bright character. Soulful and energetic, perfect for dancefloor energy and groove.',
        blob_path: 'stems/darksco-daytime-001/vocal-chop-loop.wav',
        version: 1,
        status: 'processed',
      },
    ];

    // Insert all stems
    const stemsResponse = await supabase
      .from('stems')
      .insert(daytimeStems)
      .select();

    if (stemsResponse.error) throw stemsResponse.error;
    const stems = stemsResponse.data;

    // Create production-ready clips
    const daytimeClips = [
      {
        soundbank_id: soundbank.id,
        stem_id: stems[0].id,
        name: 'Funky Bass 32-bar Loop',
        duration_seconds: 32,
        start_point: 0,
        end_point: 32,
        tags: ['loop-ready', 'foundational', 'sustained'],
        loop_ready: true,
        tempo_synced: true,
        tempo_bpm: 124,
        version: 1,
      },
      {
        soundbank_id: soundbank.id,
        stem_id: stems[1].id,
        name: 'Kick Single Hit',
        duration_seconds: 1.2,
        start_point: 0,
        end_point: 1.2,
        tags: ['single', 'percussive', 'tight'],
        loop_ready: false,
        tempo_synced: true,
        tempo_bpm: 124,
        version: 1,
      },
      {
        soundbank_id: soundbank.id,
        stem_id: stems[2].id,
        name: 'Hi-Hat 2-bar Loop',
        duration_seconds: 8,
        start_point: 0,
        end_point: 8,
        tags: ['loop-ready', 'rhythmic', 'crisp'],
        loop_ready: true,
        tempo_synced: true,
        tempo_bpm: 124,
        version: 1,
      },
      {
        soundbank_id: soundbank.id,
        stem_id: stems[4].id,
        name: 'Pad 8-bar Sustain',
        duration_seconds: 32,
        start_point: 0,
        end_point: 32,
        tags: ['sustain', 'atmospheric', 'uplifting'],
        loop_ready: false,
        tempo_synced: false,
        version: 1,
      },
      {
        soundbank_id: soundbank.id,
        stem_id: stems[6].id,
        name: 'Arpeggio Groove Loop',
        duration_seconds: 16,
        start_point: 0,
        end_point: 16,
        tags: ['loop-ready', 'groovy', 'funky'],
        loop_ready: true,
        tempo_synced: true,
        tempo_bpm: 124,
        version: 1,
      },
    ];

    const clipsResponse = await supabase
      .from('clips')
      .insert(daytimeClips)
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
        message:
          'Professional DARKSCO Daytime soundbank created successfully',
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
          clips: daytimeClips.map((c) => ({
            id: c.id,
            name: c.name,
            duration: c.duration_seconds,
            loop_ready: c.loop_ready,
          })),
          next_steps: [
            '✓ Sound Design Profile created (Daytime variant)',
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
    console.error('[v0] DARKSCO Daytime seed error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create DARKSCO Daytime soundbank',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
