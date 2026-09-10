#[derive(Debug, Clone, PartialEq, Eq)]
pub struct View {
    pub headline: alloc::string::String,
    pub lede: alloc::string::String,
    pub promptPlaceholder: alloc::string::String,
    pub sendLabel: alloc::string::String,
    pub buildingLabel: alloc::string::String,
    pub previewLabel: alloc::string::String,
    pub snapshotLabel: alloc::string::String,
    pub rollbackLabel: alloc::string::String,
    pub refusedLabel: alloc::string::String,
    pub offlineLabel: alloc::string::String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Grant {
    pub endpoint: alloc::string::String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Capabilities {
    pub endpoints: alloc::vec::Vec<crate::Grant>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Project {
    pub label: alloc::string::String,
    pub entries: alloc::vec::Vec<crate::Entry>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum Decision {
    Accept = 0,
    Refuse = 1,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Ref {
    pub branch: alloc::string::String,
    pub kappa: alloc::string::String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    pub path: alloc::string::String,
    pub kappa: alloc::string::String,
    pub bytes: u64,
}

pub fn admits(x_1: &[crate::Grant], x_2: &str) -> bool {
    match x_1 {
        [] => { let _x_31 = false; _x_31 },
        [head_20, tail_21 @ ..] => { let _x_40 = grantEndpoint(&(head_20)); { let _x_41 = (_x_40 == x_2); match _x_41 {
        false => { let _x_54 = admits(&(tail_21), (x_2).as_ref()); _x_54 },
        true => _x_41,
    } } },
    }
}

pub fn entryKappa(entry: &crate::Entry) -> alloc::string::String {
    { let _x_8 = &(entry).kappa; { let _x_20 = 2147483647; { let _x_13 = { let __value = _x_8; let __delimiter = alloc::string::String::from("\n"); let __maximum = usize::try_from(_x_20).ok(); if __delimiter.is_empty() { None } else { let __fields: alloc::vec::Vec<alloc::string::String> = __value.split(&__delimiter).map(alloc::string::String::from).collect(); __maximum.filter(|__maximum| __fields.len() <= *__maximum).map(|_| __fields) } }; match _x_13 {
        None => alloc::string::String::from(""),
        Some(val_16) => { let _x_25 = (val_16).join(&alloc::string::String::from("\n")); _x_25 },
    } } } }
}

pub fn entryLine(entry: &crate::Entry) -> alloc::string::String {
    { let _x_3 = entryPath(&(entry)); { let _x_32 = escapeReturn(_x_3); { let _x_6 = alloc::vec![alloc::string::String::from("\"")]; { let _x_7 = { let mut __list = alloc::vec![_x_32]; __list.extend(_x_6.clone()); __list }; { let _x_8 = { let mut __list = alloc::vec![alloc::string::String::from("\"")]; __list.extend(_x_7); __list }; { let _x_10 = (_x_8).join(&alloc::string::String::from("")); { let _x_12 = entryKappa(&(entry)); { let _x_33 = escapeReturn(_x_12); { let _x_14 = { let mut __list = alloc::vec![_x_33]; __list.extend(_x_6.clone()); __list }; { let _x_15 = { let mut __list = alloc::vec![alloc::string::String::from("\"")]; __list.extend(_x_14); __list }; { let _x_16 = (_x_15).join(&alloc::string::String::from("")); { let _x_20 = (entry).bytes; { let _x_21 = alloc::format!("{}", _x_20); { let _x_23 = alloc::vec![alloc::string::String::from("]")]; { let _x_24 = { let mut __list = alloc::vec![_x_21]; __list.extend(_x_23); __list }; { let _x_25 = { let mut __list = alloc::vec![alloc::string::String::from(",")]; __list.extend(_x_24); __list }; { let _x_26 = { let mut __list = alloc::vec![_x_16]; __list.extend(_x_25); __list }; { let _x_27 = { let mut __list = alloc::vec![alloc::string::String::from(",")]; __list.extend(_x_26); __list }; { let _x_28 = { let mut __list = alloc::vec![_x_10]; __list.extend(_x_27); __list }; { let _x_29 = { let mut __list = alloc::vec![alloc::string::String::from("[")]; __list.extend(_x_28); __list }; { let _x_30 = (_x_29).join(&alloc::string::String::from("")); _x_30 } } } } } } } } } } } } } } } } } } } } }
}

pub fn entryLines(x_1: &[crate::Entry]) -> alloc::string::String {
    match x_1 {
        [] => alloc::string::String::from(""),
        [head_29, tail_30 @ ..] => match tail_30 {
        [] => { let _x_49 = entryLine(&(head_29)); _x_49 },
        [head_50, tail_51 @ ..] => { let head_50 = head_50.clone(); { let _x_53 = entryLine(&(head_29)); { let _x_54 = entryLines(&(tail_30)); { let _x_56 = alloc::vec![_x_54]; { let _x_57 = { let mut __list = alloc::vec![_x_53]; __list.extend(_x_56); __list }; { let _x_59 = (_x_57).join(&alloc::string::String::from(",")); _x_59 } } } } } },
    },
    }
}

pub fn entryPath(entry: &crate::Entry) -> alloc::string::String {
    { let _x_8 = &(entry).path; { let _x_20 = 2147483647; { let _x_13 = { let __value = _x_8; let __delimiter = alloc::string::String::from("\n"); let __maximum = usize::try_from(_x_20).ok(); if __delimiter.is_empty() { None } else { let __fields: alloc::vec::Vec<alloc::string::String> = __value.split(&__delimiter).map(alloc::string::String::from).collect(); __maximum.filter(|__maximum| __fields.len() <= *__maximum).map(|_| __fields) } }; match _x_13 {
        None => alloc::string::String::from(""),
        Some(val_16) => { let _x_25 = (val_16).join(&alloc::string::String::from("\n")); _x_25 },
    } } } }
}

pub fn escapeBackslash(value: alloc::string::String) -> alloc::string::String {
    { let _x_19 = 2147483647; { let _x_12 = { let __value = value; let __delimiter = alloc::string::String::from("\\"); let __maximum = usize::try_from(_x_19).ok(); if __delimiter.is_empty() { None } else { let __fields: alloc::vec::Vec<alloc::string::String> = __value.split(&__delimiter).map(alloc::string::String::from).collect(); __maximum.filter(|__maximum| __fields.len() <= *__maximum).map(|_| __fields) } }; match _x_12 {
        None => alloc::string::String::from(""),
        Some(val_15) => { let _x_24 = (val_15).join(&alloc::string::String::from("\\\\")); _x_24 },
    } } }
}

pub fn escapeJson(value: alloc::string::String) -> alloc::string::String {
    { let _x_1 = escapeReturn(value); _x_1 }
}

pub fn escapeNewline(value: alloc::string::String) -> alloc::string::String {
    { let _x_8 = escapeQuote(value); { let _x_20 = 2147483647; { let _x_13 = { let __value = _x_8; let __delimiter = alloc::string::String::from("\n"); let __maximum = usize::try_from(_x_20).ok(); if __delimiter.is_empty() { None } else { let __fields: alloc::vec::Vec<alloc::string::String> = __value.split(&__delimiter).map(alloc::string::String::from).collect(); __maximum.filter(|__maximum| __fields.len() <= *__maximum).map(|_| __fields) } }; match _x_13 {
        None => alloc::string::String::from(""),
        Some(val_16) => { let _x_25 = (val_16).join(&alloc::string::String::from("\\n")); _x_25 },
    } } } }
}

pub fn escapeQuote(value: alloc::string::String) -> alloc::string::String {
    { let _x_8 = escapeBackslash(value); { let _x_20 = 2147483647; { let _x_13 = { let __value = _x_8; let __delimiter = alloc::string::String::from("\""); let __maximum = usize::try_from(_x_20).ok(); if __delimiter.is_empty() { None } else { let __fields: alloc::vec::Vec<alloc::string::String> = __value.split(&__delimiter).map(alloc::string::String::from).collect(); __maximum.filter(|__maximum| __fields.len() <= *__maximum).map(|_| __fields) } }; match _x_13 {
        None => alloc::string::String::from(""),
        Some(val_16) => { let _x_25 = (val_16).join(&alloc::string::String::from("\\\"")); _x_25 },
    } } } }
}

pub fn escapeReturn(value: alloc::string::String) -> alloc::string::String {
    { let _x_8 = escapeNewline(value); { let _x_20 = 2147483647; { let _x_13 = { let __value = _x_8; let __delimiter = alloc::string::String::from("\r"); let __maximum = usize::try_from(_x_20).ok(); if __delimiter.is_empty() { None } else { let __fields: alloc::vec::Vec<alloc::string::String> = __value.split(&__delimiter).map(alloc::string::String::from).collect(); __maximum.filter(|__maximum| __fields.len() <= *__maximum).map(|_| __fields) } }; match _x_13 {
        None => alloc::string::String::from(""),
        Some(val_16) => { let _x_25 = (val_16).join(&alloc::string::String::from("\\r")); _x_25 },
    } } } }
}

pub fn grantEndpoint(grant: &crate::Grant) -> alloc::string::String {
    { let _x_8 = &(grant).endpoint; { let _x_20 = 2147483647; { let _x_13 = { let __value = _x_8; let __delimiter = alloc::string::String::from("\n"); let __maximum = usize::try_from(_x_20).ok(); if __delimiter.is_empty() { None } else { let __fields: alloc::vec::Vec<alloc::string::String> = __value.split(&__delimiter).map(alloc::string::String::from).collect(); __maximum.filter(|__maximum| __fields.len() <= *__maximum).map(|_| __fields) } }; match _x_13 {
        None => alloc::string::String::from(""),
        Some(val_16) => { let _x_25 = (val_16).join(&alloc::string::String::from("\n")); _x_25 },
    } } } }
}

pub fn headOf(x_1: &[crate::Ref], x_2: alloc::string::String) -> Option<alloc::string::String> {
    match x_1 {
        [] => None,
        [head_21, tail_22 @ ..] => { let _x_42 = refBranch(&(head_21)); { let _x_43 = (_x_42 == x_2.clone()); match _x_43 {
        false => { let _x_56 = headOf(&(tail_22), x_2.clone()); _x_56 },
        true => { let _x_57 = refKappa(&(head_21)); { let _x_58 = Some(_x_57); _x_58 } },
    } } },
    }
}

pub fn networkDecision(capabilities: &crate::Capabilities, origin: alloc::string::String) -> crate::Decision {
    { let _x_1 = &(capabilities).endpoints; { let _x_2 = admits(&(_x_1), (origin).as_ref()); match _x_2 {
        false => { let _x_25 = crate::Decision::Refuse; _x_25 },
        true => { let _x_26 = crate::Decision::Accept; _x_26 },
    } } }
}

pub fn previewPath(kappa: alloc::string::String) -> alloc::string::String {
    { let _x_4 = alloc::vec![alloc::string::String::from("/")]; { let _x_5 = { let mut __list = alloc::vec![kappa]; __list.extend(_x_4); __list }; { let _x_6 = { let mut __list = alloc::vec![alloc::string::String::from("/p/")]; __list.extend(_x_5); __list }; { let _x_8 = (_x_6).join(&alloc::string::String::from("")); _x_8 } } } }
}

pub fn projectName(project: &crate::Project) -> alloc::string::String {
    { let _x_8 = &(project).label; { let _x_20 = 2147483647; { let _x_13 = { let __value = _x_8; let __delimiter = alloc::string::String::from("\n"); let __maximum = usize::try_from(_x_20).ok(); if __delimiter.is_empty() { None } else { let __fields: alloc::vec::Vec<alloc::string::String> = __value.split(&__delimiter).map(alloc::string::String::from).collect(); __maximum.filter(|__maximum| __fields.len() <= *__maximum).map(|_| __fields) } }; match _x_13 {
        None => alloc::string::String::from(""),
        Some(val_16) => { let _x_25 = (val_16).join(&alloc::string::String::from("\n")); _x_25 },
    } } } }
}

pub fn refBranch(__prod_ref: &crate::Ref) -> alloc::string::String {
    { let _x_8 = &(__prod_ref).branch; { let _x_20 = 2147483647; { let _x_13 = { let __value = _x_8; let __delimiter = alloc::string::String::from("\n"); let __maximum = usize::try_from(_x_20).ok(); if __delimiter.is_empty() { None } else { let __fields: alloc::vec::Vec<alloc::string::String> = __value.split(&__delimiter).map(alloc::string::String::from).collect(); __maximum.filter(|__maximum| __fields.len() <= *__maximum).map(|_| __fields) } }; match _x_13 {
        None => alloc::string::String::from(""),
        Some(val_16) => { let _x_25 = (val_16).join(&alloc::string::String::from("\n")); _x_25 },
    } } } }
}

pub fn refKappa(__prod_ref: &crate::Ref) -> alloc::string::String {
    { let _x_8 = &(__prod_ref).kappa; { let _x_20 = 2147483647; { let _x_13 = { let __value = _x_8; let __delimiter = alloc::string::String::from("\n"); let __maximum = usize::try_from(_x_20).ok(); if __delimiter.is_empty() { None } else { let __fields: alloc::vec::Vec<alloc::string::String> = __value.split(&__delimiter).map(alloc::string::String::from).collect(); __maximum.filter(|__maximum| __fields.len() <= *__maximum).map(|_| __fields) } }; match _x_13 {
        None => alloc::string::String::from(""),
        Some(val_16) => { let _x_25 = (val_16).join(&alloc::string::String::from("\n")); _x_25 },
    } } } }
}

pub fn restoreDecision(derived: alloc::string::String, expected: alloc::string::String) -> crate::Decision {
    { let _x_3 = (derived == expected); match _x_3 {
        false => { let _x_26 = crate::Decision::Refuse; _x_26 },
        true => { let _x_27 = crate::Decision::Accept; _x_27 },
    } }
}

pub fn snapshotPreimage(project: &crate::Project, parent: alloc::string::String) -> alloc::string::String {
    { let _x_2 = &(project).entries; { let _x_3 = entryLines(&(_x_2)); { let _x_6 = projectName(&(project)); { let _x_29 = escapeReturn(_x_6); { let _x_9 = alloc::vec![alloc::string::String::from("\"")]; { let _x_10 = { let mut __list = alloc::vec![_x_29]; __list.extend(_x_9.clone()); __list }; { let _x_11 = { let mut __list = alloc::vec![alloc::string::String::from("\"")]; __list.extend(_x_10); __list }; { let _x_13 = (_x_11).join(&alloc::string::String::from("")); { let _x_30 = escapeReturn(parent); { let _x_16 = { let mut __list = alloc::vec![_x_30]; __list.extend(_x_9.clone()); __list }; { let _x_17 = { let mut __list = alloc::vec![alloc::string::String::from("\"")]; __list.extend(_x_16); __list }; { let _x_18 = (_x_17).join(&alloc::string::String::from("")); { let _x_20 = alloc::vec![alloc::string::String::from("}")]; { let _x_21 = { let mut __list = alloc::vec![_x_18]; __list.extend(_x_20); __list }; { let _x_22 = { let mut __list = alloc::vec![alloc::string::String::from(",\"parent\":")]; __list.extend(_x_21); __list }; { let _x_23 = { let mut __list = alloc::vec![_x_13]; __list.extend(_x_22); __list }; { let _x_24 = { let mut __list = alloc::vec![alloc::string::String::from("],\"name\":")]; __list.extend(_x_23); __list }; { let _x_25 = { let mut __list = alloc::vec![_x_3]; __list.extend(_x_24); __list }; { let _x_26 = { let mut __list = alloc::vec![alloc::string::String::from("{\"entries\":[")]; __list.extend(_x_25); __list }; { let _x_27 = (_x_26).join(&alloc::string::String::from("")); _x_27 } } } } } } } } } } } } } } } } } } } }
}

pub fn view() -> crate::View {
    { let _x_11 = crate::View { headline: alloc::string::String::from("Own Your Ideas"), lede: alloc::string::String::from("Describe it. It builds, runs and stays yours, in this browser, on no server."), promptPlaceholder: alloc::string::String::from("What do you want to build?"), sendLabel: alloc::string::String::from("Build"), buildingLabel: alloc::string::String::from("building in your browser"), previewLabel: alloc::string::String::from("Preview"), snapshotLabel: alloc::string::String::from("Sealed"), rollbackLabel: alloc::string::String::from("Go back"), refusedLabel: alloc::string::String::from("Refused: not what it claims to be"), offlineLabel: alloc::string::String::from("offline, working from your device") }; _x_11 }
}

