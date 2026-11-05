// Whether a finished video is checked and remade.
// false (for now): the video is final as soon as it is put together. There is no Twelve Labs watch,
// no QA Gate 2 and no remaking of scenes; the brief is still checked before anything is paid for (Gate 1).
// Change it to true to bring the watch, the score and up to two remakes of the flagged scenes back.
// Images and carousels are unaffected.

export const VIDEO_QA = false;

export const videoQaEnabled = (): boolean => VIDEO_QA;
