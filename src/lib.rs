// SPDX-FileCopyrightText: 2024 AFCMS <afcm.contact@gmail.com>
// SPDX-License-Identifier: MIT

extern crate oxipng;

wit_bindgen::generate!({
    world: "vsc-oxipng",
});

struct VscOxipng;

impl Guest for VscOxipng {
    fn add(left: u64, right: u64) -> u64 {
        log("Calculating...");
        return left + right;
    }

    fn optimise(in_data: Vec<u8>) -> Vec<u8> {
        log("Starting optimising...");
        let png = oxipng::optimize_from_memory(&in_data, &oxipng::Options::from_preset(1));
        log("Finished optimising");
        return png.unwrap();
    }
}

export!(VscOxipng);
