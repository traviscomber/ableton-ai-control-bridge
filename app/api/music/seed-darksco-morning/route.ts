import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET() {
  try {
    // Create Sound Design Profile for DARKSCO Morning
    const profileResponse = await supabase
      .from('sound_design_profiles')
      .insert({
        name: 'DARKSCO - Morning (Fresh Dark Disco)',
        style: 'dark disco funk techno',
        bpm: 116,
        key: 'G major',
        time_signature: '4/4',
        production_goal:
          'Fresh, groovy dark disco funk for morning sets with warm organic feel and soulful grooves',
        mood_keywords: ['soulful', 'funky', 'smooth', 'warm', 'wakeful'],
        instrumentation: [
          'soulful bass',
          'organic kick',
          'analog hi-hat',
          'snare',
          'warm pad',
          'synth stab',
          'soulful arpeggio',
          'vocal loop',
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
        name: 'DARKSCO v1.0 - Morning',
        version: 1,
        bpm: 116,
        key: 'G major',
        status: 'stems-uploaded',
        total_stems: 8,
      })
      .select()
      .single();

    if (soundbankResponse.error) throw soundbankResponse.error;
    const soundbank = soundbankResponse.data;

    // Define DARKSCO Morning Stems
    const morningStems = [
      {
        soundbank_id: soundbank.id,
        name: 'Soulful Bass Line 65Hz',
        instrument_type: 'bass',
        category: 'foundational',
        duration_seconds: 32,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [55, 130],
        dynamics: 'sustain',
        processing: ['warm-tone', 'smooth-compression'],
        description:
          'Warm, groovy soulful bass at 65Hz with organic character. Perfect for morning warmth and groove pocket.',
        blob_path: 'stems/darksco-morning-001/soulful-bass-65hz.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Kick Drum Organic',
        instrument_type: 'drum',
        category: 'percussive',
        duration_seconds: 1.2,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [50, 250],
        dynamics: 'percussive',
        processing: ['warm-eq', 'round-transient'],
        description:
          'Organic, round kick drum with warm tone. Soulful and smooth, perfect for morning energy without harshness.',
        blob_path: 'stems/darksco-morning-001/kick-drum-organic.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Hi-Hat Analog Loop',
        instrument_type: 'drum',
        category: 'percussive',
        duration_seconds: 8,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [3000, 12000],
        dynamics: 'percussive',
        processing: ['analog-warmth', 'smooth-transient'],
        description:
          'Warm, analog-sounding hi-hat with organic character. 16th-note pattern at 116 BPM, perfect morning groove.',
        blob_path: 'stems/darksco-morning-001/hi-hat-analog-loop.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Snare Soulful',
        instrument_type: 'drum',
        category: 'percussive',
        duration_seconds: 0.8,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [200, 5000],
        dynamics: 'percussive',
        processing: ['warm-eq', 'soulful-character'],
        description:
          'Warm, soulful snare with punchy character. Organic feel perfect for morning groove and warmth.',
        blob_path: 'stems/darksco-morning-001/snare-soulful.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Warm Pad Synth',
        instrument_type: 'synth',
        category: 'textural',
        duration_seconds: 48,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [200, 2500],
        dynamics: 'sustain',
        processing: ['warm-filter', 'smooth-modulation'],
        description:
          'Soulful, warm pad synth with smooth modulation. Creates soulful atmosphere perfect for morning warmth.',
        blob_path: 'stems/darksco-morning-001/warm-pad-synth.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Stab Synth Warm',
        instrument_type: 'synth',
        category: 'percussive',
        duration_seconds: 2.4,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [300, 3500],
        dynamics: 'percussive',
        processing: ['warm-eq', 'smooth-attack'],
        description:
          'Warm, percussive synth stab with soulful character. Perfect for rhythmic punctuation in morning sets.',
        blob_path: 'stems/darksco-morning-001/stab-synth-warm.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Arpeggio Soulful',
        instrument_type: 'synth',
        category: 'textural',
        duration_seconds: 16,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [400, 4000],
        dynamics: 'dynamic',
        processing: ['soulful-arpeggio', 'warm-tone'],
        description:
          'Groovy, soulful arpeggiated synth with warm melodic character. 16th-note pattern adds soulful movement.',
        blob_path: 'stems/darksco-morning-001/arpeggio-soulful.wav',
        version: 1,
        status: 'processed',
      },
      {
        soundbank_id: soundbank.id,
        name: 'Vocal Loop Warm',
        instrument_type: 'vocal',
        category: 'textural',
        duration_seconds: 8,
        sample_rate: 48000,
        bit_depth: 24,
        format: 'wav',
        frequency_range: [300, 5000],
        dynamics: 'percussive',
        processing: ['warm-tone', 'soulful-character'],
        description:
          'Soulful, warm vocal loop with melodic character. Perfect for morning groove and human warmth.',
        blob_path: 'stems/darksco-morning-001/vocal-loop-warm.wav',
        version: 1,
        status: 'processed',
      },
    ];

    // Insert all stems
    const stemsResponse = await supabase
      .from('stems')
      .insert(morningStems)
      .select();

    if (stemsResponse.error) throw stemsResponse.error;
    const stems = stemsResponse.data;

    // Create production-ready clips
    const morningClips = [
      {
        soundbank_id: soundbank.id,
        stem_id: stems[0].id,
        name: 'Soulful Bass 32-bar Loop',
        duration_seconds: 32,
        start_point: 0,
        end_point: 32,
        tags: ['loop-ready', 'foundational', 'soulful'],
        loop_ready: true,
        tempo_synced: true,
        tempo_bpm: 116,
        version: 1,
      },
      {
        soundbank_id: soundbank.id,
        stem_id: stems[1].id,
        name: 'Kick Single Hit',
        duration_seconds: 1.2,
        start_point: 0,
        end_point: 1.2,
        tags: ['single', 'organic', 'warm'],
        loop_ready: false,
        tempo_synced: true,
        tempo_bpm: 116,
        version: 1,
      },
      {
        soundbank_id: soundbank.id,
        stem_id: stems[2].id,
        name: 'Hi-Hat 2-bar Loop',
        duration_seconds: 8,
        start_point: 0,
        end_point: 8,
        tags: ['loop-ready', 'analog', 'warm'],
        loop_ready: true,
        tempo_synced: true,
        tempo_bpm: 116,
        version: 1,
      },
      {
        soundbank_id: soundbank.id,
        stem_id: stems[4].id,
        name: 'Pad 8-bar Sustain',
        duration_seconds: 32,
        start_point: 0,
        end_point: 32,
        tags: ['sustain', 'warm', 'soulful'],
        loop_ready: false,
        tempo_synced: false,
        version: 1,
      },
      {
        soundbank_id: soundbank.id,
        stem_id: stems[6].id,
        name: 'Arpeggio Warm Loop',
        duration_seconds: 16,
        start_point: 0,
        end_point: 16,
        tags: ['loop-ready', 'soulful', 'melodic'],
        loop_ready: true,
        tempo_synced: true,
        tempo_bpm: 116,
        version: 1,
      },
    ];

    const clipsResponse = await supabase
      .from('clips')
      .insert(morningClips)
      .select();

    if (clipsResponse.error) throw clipsResponse.error;
    const clips = clipsResponse.data;

    // Update soundbank status
    await supabase
      .from('soundbanks')
      .update({ status: 'clips-extracted', total_clips: 5 })
      .eq('id', soundbank.id);

    return NextResponse.json(
      {
        success: true,
        message:
          'Professional DARKSCO Morning soundbank created successfully',
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
          clips: clips.map((c) => ({
            id: c.id,
            name: c.name,
            duration: c.duration_seconds,
            loop_ready: c.loop_ready,
          })),
          next_steps: [
            '✓ Sound Design Profile created (Morning variant)',
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
    console.error('[v0] DARKSCO Morning seed error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create DARKSCO Morning soundbank',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
