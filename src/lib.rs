// SPDX-FileCopyrightText: 2024 AFCMS <afcm.contact@gmail.com>
// SPDX-License-Identifier: MIT

use std::num::NonZeroU8;

extern crate oxipng;

wit_bindgen::generate!({
    world: "vsc-oxipng",
});

struct VscOxipng;

impl Guest for VscOxipng {
    fn optimise(in_data: Vec<u8>, preset: u8, strip: StripMetadata, zopfli: bool) -> Vec<u8> {
        log("Starting optimising...");
        let mut options = oxipng::Options::from_preset(preset);

        if zopfli {
            options.deflate = oxipng::Deflaters::Zopfli {
                iterations: NonZeroU8::new(15).unwrap(),
            };
        }

        match strip {
            StripMetadata::None => options.strip = oxipng::StripChunks::None,
            StripMetadata::Safe => options.strip = oxipng::StripChunks::Safe,
            StripMetadata::All => {
                options.strip = oxipng::StripChunks::Keep([*b"acTL", *b"fcTL", *b"fdAT"].into())
            }
        }

        let png = oxipng::optimize_from_memory(&in_data, &options);
        log("Finished optimising");
        return png.unwrap();
    }
}

export!(VscOxipng);
