-- =============================================================================
-- Seed: Hong Kong Tertiary Institutions — Schools + Major Requirements
-- Source: training_knowledge (estimated from JUPAS / institution publications)
-- Generated: 2026-03-28
-- WARNING: All scores and JUPAS codes are estimates based on training data.
--          Verify against official JUPAS / institution publications before
--          use in production. All minimum/average scores are HKDSE best-5
--          aggregates (max 35 for 5 subjects at 5**=7 each).
-- =============================================================================

-- Schools table columns used here:
--   id, name, name_zh, type, location, website, description,
--   minimum_entry_score, required_subjects, language_requirements,
--   notable_programs, faculties, acceptance_rate, average_admitted_score,
--   scholarship_available, is_custom, major_requirements,
--   data_source, data_last_updated, created_at, updated_at
--
-- major_requirements JSON structure (array of program objects):
--   [{ "major", "jupas_code", "minimum_score", "average_score",
--      "required_subjects", "preferred_subjects", "notes" }, ...]
--
-- ON CONFLICT (name) DO UPDATE preserves existing rows but refreshes
-- major_requirements and score data (idempotent re-seed).
-- =============================================================================

INSERT INTO schools (
  id, name, name_zh, type, location, website, description,
  minimum_entry_score, required_subjects, language_requirements,
  notable_programs, faculties, acceptance_rate, average_admitted_score,
  scholarship_available, is_custom, major_requirements,
  data_source, data_last_updated, created_at, updated_at
) VALUES

-- ============================================================
-- 1. The University of Hong Kong (HKU)
--    UUID: 20000000-0000-0000-0000-000000000001
-- ============================================================
(
  '20000000-0000-0000-0000-000000000001',
  'The University of Hong Kong',
  '香港大學',
  'UNIVERSITY',
  'Pokfulam, Hong Kong Island',
  'https://www.hku.hk',
  'Founded in 1911, HKU is Hong Kong''s oldest and most prestigious university, consistently ranked among the top universities in Asia. It offers comprehensive undergraduate, postgraduate, and doctoral programmes across nine faculties, with particular strengths in medicine, law, and the sciences.',
  20,
  '[{"code":"CHLA","min_grade":"3"},{"code":"ENGL","min_grade":"3"},{"code":"MATH","min_grade":"3"},{"code":"CSD","min_grade":"2"}]',
  '{"ielts_minimum":6.5,"toefl_minimum":80}',
  '["MBBS Medicine","LLB Law","BEng Computer Science","BBA Business Administration","BSc Data Science","BEng Civil Engineering","BSc Nursing","BSSc Psychology","BA Literary Studies","BSc Mathematics"]',
  '["Faculty of Arts","Faculty of Business and Economics","Faculty of Dentistry","Faculty of Education","Faculty of Engineering","Faculty of Law","Faculty of Medicine","Faculty of Science","Faculty of Social Sciences"]',
  0.16,
  28.5,
  TRUE,
  FALSE,
  '[
    {"major":"Medicine (MBBS)","jupas_code":"JS6004","minimum_score":31,"average_score":33,"required_subjects":["BIOL","CHEM"],"preferred_subjects":["PHYS"],"notes":"Extremely competitive; interview required"},
    {"major":"Law (LLB)","jupas_code":"JS6462","minimum_score":30,"average_score":32,"required_subjects":["ENGL"],"preferred_subjects":[],"notes":"Verbal reasoning test required"},
    {"major":"Computer Science","jupas_code":"JS6101","minimum_score":25,"average_score":28,"required_subjects":["MATH"],"preferred_subjects":["M1","M2","ICT"],"notes":"M1/M2 advantage; strong programming aptitude expected"},
    {"major":"Business Administration","jupas_code":"JS6702","minimum_score":26,"average_score":29,"required_subjects":["ENGL","MATH"],"preferred_subjects":["ECON","BAFS"],"notes":"Top-ranked business school in Asia"},
    {"major":"Data Science and Statistics","jupas_code":"JS6912","minimum_score":24,"average_score":27,"required_subjects":["MATH"],"preferred_subjects":["M1","M2","ICT"],"notes":"Interdisciplinary; students take courses in CS, Statistics and domain sciences"},
    {"major":"Civil and Structural Engineering","jupas_code":"JS6141","minimum_score":23,"average_score":26,"required_subjects":["MATH","PHYS"],"preferred_subjects":["M2"],"notes":"Accredited by HKIE"},
    {"major":"Mechanical Engineering","jupas_code":"JS6151","minimum_score":23,"average_score":26,"required_subjects":["MATH","PHYS"],"preferred_subjects":["M2"],"notes":"Accredited by HKIE"},
    {"major":"Electrical and Electronic Engineering","jupas_code":"JS6161","minimum_score":23,"average_score":27,"required_subjects":["MATH","PHYS"],"preferred_subjects":["M2"],"notes":"Strong ties with local industry"},
    {"major":"Nursing (BNurs)","jupas_code":"JS6812","minimum_score":20,"average_score":23,"required_subjects":["BIOL","ENGL"],"preferred_subjects":["CHEM","HMSC"],"notes":"Clinical placements at HKU-affiliated hospitals"},
    {"major":"Psychology (BSocSc)","jupas_code":"JS6917","minimum_score":24,"average_score":27,"required_subjects":["ENGL"],"preferred_subjects":["BIOL","ECON"],"notes":"Research-oriented; postgrad pathways to clinical practice"},
    {"major":"Economics (BEcon&Fin)","jupas_code":"JS6711","minimum_score":25,"average_score":28,"required_subjects":["MATH"],"preferred_subjects":["ECON","M1","M2"],"notes":"Finance track available"},
    {"major":"Architecture","jupas_code":"JS6211","minimum_score":24,"average_score":27,"required_subjects":["ENGL","MATH"],"preferred_subjects":["VART","DAT"],"notes":"Portfolio required; 5-year ARB-accredited programme"}
  ]',
  'training_knowledge',
  '2024-01-01',
  NOW(), NOW()
),

-- ============================================================
-- 2. The Chinese University of Hong Kong (CUHK)
--    UUID: 20000000-0000-0000-0000-000000000002
-- ============================================================
(
  '20000000-0000-0000-0000-000000000002',
  'The Chinese University of Hong Kong',
  '香港中文大學',
  'UNIVERSITY',
  'Sha Tin, New Territories',
  'https://www.cuhk.edu.hk',
  'Established in 1963, CUHK is a comprehensive research university with a strong bilingual tradition. Known for its collegiate system, Chinese culture programmes, and world-class medical and business schools, it consistently ranks among the top universities in Asia.',
  18,
  '[{"code":"CHLA","min_grade":"3"},{"code":"ENGL","min_grade":"3"},{"code":"MATH","min_grade":"2"},{"code":"CSD","min_grade":"2"}]',
  '{"ielts_minimum":6.5,"toefl_minimum":79}',
  '["Medicine (Chinese Medicine & MBBS)","Law","Business Administration","Computer Science","Accounting","Finance","Social Work","Statistics","Biochemistry","Journalism"]',
  '["Faculty of Arts","Faculty of Business Administration","Faculty of Education","Faculty of Engineering","Faculty of Law","Faculty of Medicine","Faculty of Science","Faculty of Social Science"]',
  0.20,
  27.0,
  TRUE,
  FALSE,
  '[
    {"major":"Medicine (MBBS)","jupas_code":"JS4461","minimum_score":31,"average_score":33,"required_subjects":["BIOL","CHEM"],"preferred_subjects":["PHYS"],"notes":"Bilingual programme; interview required"},
    {"major":"Chinese Medicine","jupas_code":"JS4801","minimum_score":23,"average_score":26,"required_subjects":["BIOL","CHEM"],"preferred_subjects":["CHLA"],"notes":"5-year programme; clinical training included"},
    {"major":"Law (LLB)","jupas_code":"JS4462","minimum_score":30,"average_score":32,"required_subjects":["ENGL"],"preferred_subjects":[],"notes":"One of two PCLL-pathway law schools in HK"},
    {"major":"Computer Science","jupas_code":"JS4101","minimum_score":24,"average_score":27,"required_subjects":["MATH"],"preferred_subjects":["M1","M2","ICT"],"notes":"Strong AI and systems research groups"},
    {"major":"Business Administration","jupas_code":"JS4700","minimum_score":25,"average_score":28,"required_subjects":["ENGL","MATH"],"preferred_subjects":["ECON","BAFS"],"notes":"AACSB-accredited; exchange programme at top global business schools"},
    {"major":"Accounting","jupas_code":"JS4702","minimum_score":24,"average_score":27,"required_subjects":["MATH"],"preferred_subjects":["BAFS","ECON"],"notes":"Recognised by HKICPA and ACCA"},
    {"major":"Finance","jupas_code":"JS4711","minimum_score":25,"average_score":28,"required_subjects":["MATH"],"preferred_subjects":["ECON","M1","M2"],"notes":"Close links to HK financial industry"},
    {"major":"Statistics","jupas_code":"JS4912","minimum_score":22,"average_score":25,"required_subjects":["MATH"],"preferred_subjects":["M1","M2"],"notes":"Strong actuarial track"},
    {"major":"Electrical Engineering","jupas_code":"JS4161","minimum_score":22,"average_score":25,"required_subjects":["MATH","PHYS"],"preferred_subjects":["M2"],"notes":"HKIE-accredited 4-year BEng"},
    {"major":"Psychology","jupas_code":"JS4923","minimum_score":23,"average_score":26,"required_subjects":["ENGL"],"preferred_subjects":["BIOL","ECON"],"notes":"APA-model curriculum; postgrad clinical pathways"},
    {"major":"Journalism and Communication","jupas_code":"JS4602","minimum_score":21,"average_score":24,"required_subjects":["ENGL","CHLA"],"preferred_subjects":[],"notes":"Bilingual curriculum; strong media industry alumni network"},
    {"major":"Social Work","jupas_code":"JS4602","minimum_score":20,"average_score":23,"required_subjects":["ENGL"],"preferred_subjects":[],"notes":"Interview and community service record considered"}
  ]',
  'training_knowledge',
  '2024-01-01',
  NOW(), NOW()
),

-- ============================================================
-- 3. The Hong Kong University of Science and Technology (HKUST)
--    UUID: 20000000-0000-0000-0000-000000000003
-- ============================================================
(
  '20000000-0000-0000-0000-000000000003',
  'The Hong Kong University of Science and Technology',
  '香港科技大學',
  'UNIVERSITY',
  'Clear Water Bay, Kowloon',
  'https://www.ust.hk',
  'Founded in 1991, HKUST is a world-class research university focused on science, technology, engineering, and business. Consistently ranked among the top 50 universities globally for engineering and technology, it attracts students and faculty from around the world.',
  18,
  '[{"code":"CHLA","min_grade":"3"},{"code":"ENGL","min_grade":"3"},{"code":"MATH","min_grade":"3"},{"code":"CSD","min_grade":"2"}]',
  '{"ielts_minimum":6.5,"toefl_minimum":80}',
  '["Computer Science and Engineering","Electronic and Computer Engineering","Data Science and Technology","Mathematics","Business Management","Chemical and Biological Engineering","Mechanical and Aerospace Engineering","Biochemistry","Environmental Engineering"]',
  '["School of Engineering","School of Science","School of Business and Management","School of Humanities and Social Science","Interdisciplinary Programs Office"]',
  0.21,
  28.0,
  TRUE,
  FALSE,
  '[
    {"major":"Computer Science and Engineering","jupas_code":"JS5101","minimum_score":27,"average_score":30,"required_subjects":["MATH"],"preferred_subjects":["M2","ICT","PHYS"],"notes":"One of the highest-demand programs; M2 strongly recommended"},
    {"major":"Electronic and Computer Engineering","jupas_code":"JS5161","minimum_score":25,"average_score":28,"required_subjects":["MATH","PHYS"],"preferred_subjects":["M2"],"notes":"HKIE-accredited; strong semiconductor research"},
    {"major":"Data Science and Technology","jupas_code":"JS5191","minimum_score":26,"average_score":29,"required_subjects":["MATH"],"preferred_subjects":["M1","M2","ICT"],"notes":"Interdisciplinary program spanning CS, Statistics, and domain sciences"},
    {"major":"Mathematics","jupas_code":"JS5901","minimum_score":24,"average_score":27,"required_subjects":["MATH"],"preferred_subjects":["M1","M2"],"notes":"Pure and applied tracks; strong postgrad pipeline"},
    {"major":"Business Management","jupas_code":"JS5700","minimum_score":23,"average_score":27,"required_subjects":["ENGL","MATH"],"preferred_subjects":["ECON","BAFS"],"notes":"AACSB-accredited; strong fintech and entrepreneurship focus"},
    {"major":"Chemical and Biological Engineering","jupas_code":"JS5181","minimum_score":23,"average_score":26,"required_subjects":["MATH","CHEM"],"preferred_subjects":["BIOL","PHYS"],"notes":"Covers biomedical, energy, and materials tracks"},
    {"major":"Mechanical and Aerospace Engineering","jupas_code":"JS5151","minimum_score":23,"average_score":26,"required_subjects":["MATH","PHYS"],"preferred_subjects":["M2"],"notes":"Design projects and industry internships embedded"},
    {"major":"Biochemistry and Cell Biology","jupas_code":"JS5801","minimum_score":22,"average_score":25,"required_subjects":["BIOL","CHEM"],"preferred_subjects":["PHYS"],"notes":"Research-intensive; feeds into Medicine postgrad"},
    {"major":"Environmental Engineering","jupas_code":"JS5171","minimum_score":22,"average_score":25,"required_subjects":["MATH","CHEM"],"preferred_subjects":["BIOL","PHYS"],"notes":"Growing field; close links to sustainability research centres"},
    {"major":"Finance","jupas_code":"JS5711","minimum_score":25,"average_score":28,"required_subjects":["MATH"],"preferred_subjects":["ECON","M1","M2"],"notes":"Quantitative finance emphasis; top placement in HK banks"},
    {"major":"Global Business","jupas_code":"JS5720","minimum_score":22,"average_score":25,"required_subjects":["ENGL"],"preferred_subjects":["ECON","BAFS"],"notes":"International business track; exchange at partner universities"},
    {"major":"Physics","jupas_code":"JS5901","minimum_score":23,"average_score":26,"required_subjects":["MATH","PHYS"],"preferred_subjects":["M2"],"notes":"Active condensed matter and photonics research groups"}
  ]',
  'training_knowledge',
  '2024-01-01',
  NOW(), NOW()
),

-- ============================================================
-- 4. The Hong Kong Polytechnic University (PolyU)
--    UUID: 20000000-0000-0000-0000-000000000004
-- ============================================================
(
  '20000000-0000-0000-0000-000000000004',
  'The Hong Kong Polytechnic University',
  '香港理工大學',
  'POLYTECHNIC',
  'Hung Hom, Kowloon',
  'https://www.polyu.edu.hk',
  'Established in 1937 (as a technical college), PolyU is a comprehensive polytechnic university known for applied research and professional education. Its strengths lie in design, hotel management, nursing, optometry, and engineering, with strong industry linkages.',
  14,
  '[{"code":"CHLA","min_grade":"2"},{"code":"ENGL","min_grade":"3"},{"code":"MATH","min_grade":"2"},{"code":"CSD","min_grade":"1"}]',
  '{"ielts_minimum":6.0}',
  '["Nursing","Hotel and Tourism Management","Design","Optometry","Civil Engineering","Computing","Business Administration","Social Work","Applied Physics","Building Services Engineering"]',
  '["Faculty of Applied Science and Textiles","Faculty of Business","Faculty of Construction and Environment","Faculty of Engineering","Faculty of Health and Social Sciences","Faculty of Humanities","School of Design","School of Hotel and Tourism Management"]',
  0.30,
  21.0,
  TRUE,
  FALSE,
  '[
    {"major":"Nursing","jupas_code":"JS3312","minimum_score":19,"average_score":22,"required_subjects":["BIOL","ENGL"],"preferred_subjects":["CHEM","HMSC"],"notes":"Hospital placements; interview and medical check required"},
    {"major":"Optometry","jupas_code":"JS3412","minimum_score":20,"average_score":23,"required_subjects":["BIOL","PHYS"],"preferred_subjects":["CHEM"],"notes":"Only optometry programme in HK; high employment rate"},
    {"major":"Hotel Management","jupas_code":"JS3912","minimum_score":16,"average_score":19,"required_subjects":["ENGL"],"preferred_subjects":["TOUR","ECON"],"notes":"Asia''s top-ranked hospitality school; industry attachments"},
    {"major":"Design (Industrial and Product Design)","jupas_code":"JS3532","minimum_score":15,"average_score":18,"required_subjects":["ENGL"],"preferred_subjects":["VART","DAT"],"notes":"Portfolio interview; creative aptitude essential"},
    {"major":"Computing (BComp)","jupas_code":"JS3101","minimum_score":17,"average_score":20,"required_subjects":["MATH"],"preferred_subjects":["ICT","M1","M2"],"notes":"Covers software engineering, AI, cybersecurity tracks"},
    {"major":"Civil Engineering","jupas_code":"JS3211","minimum_score":16,"average_score":19,"required_subjects":["MATH","PHYS"],"preferred_subjects":["M2"],"notes":"HKIE-accredited; strong infrastructure project focus"},
    {"major":"Electrical Engineering","jupas_code":"JS3221","minimum_score":16,"average_score":19,"required_subjects":["MATH","PHYS"],"preferred_subjects":["M2"],"notes":"Smart grid and power electronics focus"},
    {"major":"Mechanical Engineering","jupas_code":"JS3231","minimum_score":16,"average_score":19,"required_subjects":["MATH","PHYS"],"preferred_subjects":["M2","DAT"],"notes":"Robotics and additive manufacturing labs"},
    {"major":"Accountancy","jupas_code":"JS3711","minimum_score":16,"average_score":19,"required_subjects":["MATH"],"preferred_subjects":["BAFS","ECON"],"notes":"HKICPA-recognised; Big-4 recruitment on campus"},
    {"major":"Business Administration","jupas_code":"JS3702","minimum_score":15,"average_score":18,"required_subjects":["ENGL"],"preferred_subjects":["ECON","BAFS","MATH"],"notes":"AACSB-accredited; strong SME and entrepreneurship network"},
    {"major":"Social Work","jupas_code":"JS3822","minimum_score":14,"average_score":17,"required_subjects":["ENGL"],"preferred_subjects":[],"notes":"SWR-registered; 800 hours of field placement"},
    {"major":"Applied Physics","jupas_code":"JS3901","minimum_score":16,"average_score":19,"required_subjects":["PHYS","MATH"],"preferred_subjects":["M2","CHEM"],"notes":"Material science, photonics, and nanotechnology focus"}
  ]',
  'training_knowledge',
  '2024-01-01',
  NOW(), NOW()
),

-- ============================================================
-- 5. City University of Hong Kong (CityU)
--    UUID: 20000000-0000-0000-0000-000000000005
-- ============================================================
(
  '20000000-0000-0000-0000-000000000005',
  'City University of Hong Kong',
  '香港城市大學',
  'UNIVERSITY',
  'Kowloon Tong, Kowloon',
  'https://www.cityu.edu.hk',
  'Founded in 1984, CityU is a dynamic research-led university known for professional education in law, business, engineering, and creative media. It has strong industry partnerships, an international student body, and a growing research profile in materials and biomedical sciences.',
  14,
  '[{"code":"CHLA","min_grade":"2"},{"code":"ENGL","min_grade":"3"},{"code":"MATH","min_grade":"2"},{"code":"CSD","min_grade":"1"}]',
  '{"ielts_minimum":6.0}',
  '["Computer Science","Law","Business Administration","Creative Media","Data Science","Electrical Engineering","Biomedical Engineering","Physics","Architecture"]',
  '["College of Business","College of Computing","School of Creative Media","School of Data Science","School of Energy and Environment","School of Law","College of Engineering","College of Liberal Arts and Social Sciences"]',
  0.31,
  20.5,
  TRUE,
  FALSE,
  '[
    {"major":"Computer Science","jupas_code":"JS1101","minimum_score":20,"average_score":23,"required_subjects":["MATH"],"preferred_subjects":["ICT","M1","M2"],"notes":"QS top-100 for CS; AI and cybersecurity specialisations available"},
    {"major":"Law (LLB)","jupas_code":"JS1462","minimum_score":23,"average_score":26,"required_subjects":["ENGL"],"preferred_subjects":[],"notes":"PCLL pathway; overseas exchanges at partner law schools"},
    {"major":"Business Administration","jupas_code":"JS1702","minimum_score":18,"average_score":21,"required_subjects":["ENGL","MATH"],"preferred_subjects":["ECON","BAFS"],"notes":"AACSB-accredited; strong fintech and e-commerce tracks"},
    {"major":"Creative Media","jupas_code":"JS1532","minimum_score":16,"average_score":19,"required_subjects":["ENGL"],"preferred_subjects":["VART","ICT"],"notes":"Portfolio and interview; industry-standard production facilities"},
    {"major":"Data Science","jupas_code":"JS1191","minimum_score":19,"average_score":22,"required_subjects":["MATH"],"preferred_subjects":["ICT","M1","M2"],"notes":"Joint programme with School of Data Science; strong analytics focus"},
    {"major":"Electrical Engineering","jupas_code":"JS1221","minimum_score":17,"average_score":20,"required_subjects":["MATH","PHYS"],"preferred_subjects":["M2"],"notes":"Smart systems and IoT specialisation"},
    {"major":"Biomedical Engineering","jupas_code":"JS1241","minimum_score":18,"average_score":21,"required_subjects":["MATH","BIOL"],"preferred_subjects":["CHEM","PHYS"],"notes":"Medical device R&D partnerships"},
    {"major":"Accountancy","jupas_code":"JS1711","minimum_score":17,"average_score":20,"required_subjects":["MATH"],"preferred_subjects":["BAFS"],"notes":"HKICPA and ACCA recognised"},
    {"major":"Physics and Astronomy","jupas_code":"JS1901","minimum_score":18,"average_score":21,"required_subjects":["PHYS","MATH"],"preferred_subjects":["M2"],"notes":"Active materials science and photonics research"},
    {"major":"Architecture and Civil Engineering","jupas_code":"JS1211","minimum_score":16,"average_score":19,"required_subjects":["MATH","PHYS"],"preferred_subjects":["M2","VART"],"notes":"Dual-track; final year students choose architecture or civil"},
    {"major":"Environmental Science","jupas_code":"JS1801","minimum_score":16,"average_score":19,"required_subjects":["CHEM","BIOL"],"preferred_subjects":["GEOG","PHYS"],"notes":"Green energy and sustainability focus"},
    {"major":"Psychology","jupas_code":"JS1923","minimum_score":17,"average_score":20,"required_subjects":["ENGL"],"preferred_subjects":["BIOL"],"notes":"Experimental and applied tracks; internship placement supported"}
  ]',
  'training_knowledge',
  '2024-01-01',
  NOW(), NOW()
),

-- ============================================================
-- 6. The Hong Kong Baptist University (HKBU)
--    UUID: 20000000-0000-0000-0000-000000000006
-- ============================================================
(
  '20000000-0000-0000-0000-000000000006',
  'The Hong Kong Baptist University',
  '香港浸會大學',
  'UNIVERSITY',
  'Kowloon Tong, Kowloon',
  'https://www.hkbu.edu.hk',
  'Founded in 1956, HKBU is a liberal arts-oriented university with a Christian heritage, known for its strengths in communication, film, Chinese medicine, and social work. It emphasises whole-person education and has a vibrant arts and culture scene.',
  13,
  '[{"code":"CHLA","min_grade":"2"},{"code":"ENGL","min_grade":"2"},{"code":"MATH","min_grade":"2"},{"code":"CSD","min_grade":"1"}]',
  '{"ielts_minimum":5.5}',
  '["Communication Studies","Film","Chinese Medicine","Social Work","Business Administration","Music","Accounting","Computer Science","Mathematics","Visual Arts"]',
  '["Faculty of Arts","Faculty of Business","Faculty of Communication","Faculty of Science","Faculty of Social Sciences","School of Chinese Medicine","Academy of Music"]',
  0.40,
  18.0,
  TRUE,
  FALSE,
  '[
    {"major":"Communication Studies","jupas_code":"JS7102","minimum_score":17,"average_score":20,"required_subjects":["ENGL"],"preferred_subjects":["CHLA"],"notes":"Journalism, advertising, and PR tracks available"},
    {"major":"Film (BA)","jupas_code":"JS7532","minimum_score":15,"average_score":18,"required_subjects":["ENGL"],"preferred_subjects":["VART"],"notes":"Portfolio and interview required; highly competitive for its cohort size"},
    {"major":"Chinese Medicine","jupas_code":"JS7801","minimum_score":17,"average_score":20,"required_subjects":["BIOL","CHEM"],"preferred_subjects":["CHLA"],"notes":"5-year programme; clinical practicum in Guangzhou and HK"},
    {"major":"Social Work","jupas_code":"JS7622","minimum_score":14,"average_score":17,"required_subjects":["ENGL"],"preferred_subjects":[],"notes":"Interview required; field placement at local NGOs"},
    {"major":"Business Administration","jupas_code":"JS7702","minimum_score":14,"average_score":17,"required_subjects":["ENGL","MATH"],"preferred_subjects":["ECON","BAFS"],"notes":"AACSB-accredited; double degree options"},
    {"major":"Accounting","jupas_code":"JS7711","minimum_score":14,"average_score":17,"required_subjects":["MATH"],"preferred_subjects":["BAFS"],"notes":"HKICPA fast-track pathway available"},
    {"major":"Computer Science","jupas_code":"JS7101","minimum_score":15,"average_score":18,"required_subjects":["MATH"],"preferred_subjects":["ICT","M1","M2"],"notes":"AI, data analytics, and software engineering focus"},
    {"major":"Mathematics","jupas_code":"JS7901","minimum_score":15,"average_score":18,"required_subjects":["MATH"],"preferred_subjects":["M1","M2"],"notes":"Pure and applied tracks; actuarial science pathway"},
    {"major":"Music (BMus)","jupas_code":"JS7531","minimum_score":13,"average_score":16,"required_subjects":[],"preferred_subjects":["MUSC"],"notes":"Audition required; classical, jazz, and composition streams"},
    {"major":"Visual Arts","jupas_code":"JS7533","minimum_score":13,"average_score":16,"required_subjects":[],"preferred_subjects":["VART"],"notes":"Portfolio interview; studio-based learning"},
    {"major":"History","jupas_code":"JS7401","minimum_score":13,"average_score":16,"required_subjects":["ENGL"],"preferred_subjects":["HIST","CHIH"],"notes":"Strong archival and public history focus"},
    {"major":"Pharmacy","jupas_code":"JS7811","minimum_score":17,"average_score":20,"required_subjects":["BIOL","CHEM"],"preferred_subjects":[],"notes":"Newly expanded; clinical placements at partner hospitals"}
  ]',
  'training_knowledge',
  '2024-01-01',
  NOW(), NOW()
),

-- ============================================================
-- 7. Lingnan University
--    UUID: 20000000-0000-0000-0000-000000000007
-- ============================================================
(
  '20000000-0000-0000-0000-000000000007',
  'Lingnan University',
  '嶺南大學',
  'UNIVERSITY',
  'Tuen Mun, New Territories',
  'https://www.ln.edu.hk',
  'Hong Kong''s only liberal arts university, Lingnan traces its roots to 1888 and emphasises small class sizes, an interdisciplinary approach, and community engagement. It offers programmes across arts, business, and social sciences with a strong focus on whole-person development and service learning.',
  12,
  '[{"code":"CHLA","min_grade":"2"},{"code":"ENGL","min_grade":"2"},{"code":"MATH","min_grade":"1"},{"code":"CSD","min_grade":"1"}]',
  '{"ielts_minimum":5.5}',
  '["Liberal Arts","Business Administration","Social Sciences","Cultural Studies","Political Science","Accounting","Data Science","Translation"]',
  '["Faculty of Arts","Faculty of Business","Faculty of Social Sciences"]',
  0.45,
  15.5,
  TRUE,
  FALSE,
  '[
    {"major":"Business Administration","jupas_code":"JS8702","minimum_score":14,"average_score":17,"required_subjects":["ENGL"],"preferred_subjects":["ECON","BAFS","MATH"],"notes":"Liberal arts emphasis; global citizenship curriculum"},
    {"major":"Accounting","jupas_code":"JS8711","minimum_score":13,"average_score":16,"required_subjects":["MATH"],"preferred_subjects":["BAFS"],"notes":"HKICPA-recognised; small cohort with close industry mentoring"},
    {"major":"Marketing","jupas_code":"JS8715","minimum_score":13,"average_score":16,"required_subjects":["ENGL"],"preferred_subjects":["ECON","BAFS"],"notes":"Digital marketing and consumer psychology focus"},
    {"major":"English","jupas_code":"JS8401","minimum_score":13,"average_score":16,"required_subjects":["ENGL"],"preferred_subjects":["ENLIT"],"notes":"Literature, language, and translation tracks"},
    {"major":"Translation","jupas_code":"JS8411","minimum_score":13,"average_score":16,"required_subjects":["ENGL","CHLA"],"preferred_subjects":[],"notes":"Chinese-English and Japanese-English streams"},
    {"major":"Philosophy","jupas_code":"JS8421","minimum_score":13,"average_score":16,"required_subjects":["ENGL"],"preferred_subjects":["ERS","HIST"],"notes":"Ethics, logic, and political philosophy focus"},
    {"major":"Sociology and Social Policy","jupas_code":"JS8622","minimum_score":12,"average_score":15,"required_subjects":["ENGL"],"preferred_subjects":["ECON","HIST"],"notes":"Community engagement projects embedded"},
    {"major":"Political Science","jupas_code":"JS8631","minimum_score":12,"average_score":15,"required_subjects":["ENGL"],"preferred_subjects":["HIST","ECON"],"notes":"Comparative politics and governance focus"},
    {"major":"Cultural Studies","jupas_code":"JS8641","minimum_score":12,"average_score":15,"required_subjects":["ENGL"],"preferred_subjects":["HIST","VART"],"notes":"Interdisciplinary; draws on arts, sociology, and media"},
    {"major":"Data Science","jupas_code":"JS8191","minimum_score":14,"average_score":17,"required_subjects":["MATH"],"preferred_subjects":["ICT","M1"],"notes":"New programme; business analytics emphasis"}
  ]',
  'training_knowledge',
  '2024-01-01',
  NOW(), NOW()
),

-- ============================================================
-- 8. Hong Kong Metropolitan University (HKMU)
--    UUID: 20000000-0000-0000-0000-000000000008
-- ============================================================
(
  '20000000-0000-0000-0000-000000000008',
  'Hong Kong Metropolitan University',
  '香港都會大學',
  'UNIVERSITY',
  'Ho Man Tin, Kowloon',
  'https://www.hkmu.edu.hk',
  'Formerly the Open University of Hong Kong (OUHK), HKMU was granted full university status in 2021. It serves a diverse student body including working adults, offering flexible full-time and part-time programmes. Its strengths include nursing, social sciences, and professional business qualifications.',
  12,
  '[{"code":"CHLA","min_grade":"2"},{"code":"ENGL","min_grade":"2"},{"code":"MATH","min_grade":"1"},{"code":"CSD","min_grade":"1"}]',
  '{"ielts_minimum":5.5}',
  '["Nursing","Social Work","Business Administration","Accounting","Computer Science","Law","Public Administration","Education"]',
  '["School of Arts and Social Sciences","School of Business","School of Education and Languages","School of Nursing and Health Studies","School of Science and Technology","School of Law"]',
  0.55,
  14.0,
  FALSE,
  FALSE,
  '[
    {"major":"Nursing (BNurs)","jupas_code":"JS2312","minimum_score":14,"average_score":17,"required_subjects":["BIOL","ENGL"],"preferred_subjects":["CHEM","HMSC"],"notes":"Hospital placements; competitive for this institution tier"},
    {"major":"Social Work","jupas_code":"JS2622","minimum_score":12,"average_score":15,"required_subjects":["ENGL"],"preferred_subjects":[],"notes":"SWR-registered; field placements in NGO sector"},
    {"major":"Business Administration","jupas_code":"JS2702","minimum_score":12,"average_score":15,"required_subjects":["ENGL"],"preferred_subjects":["ECON","BAFS"],"notes":"Flexible part-time pathway available for working students"},
    {"major":"Accounting","jupas_code":"JS2711","minimum_score":12,"average_score":15,"required_subjects":["MATH"],"preferred_subjects":["BAFS"],"notes":"HKICPA and ACCA recognised"},
    {"major":"Computer Science","jupas_code":"JS2101","minimum_score":12,"average_score":15,"required_subjects":["MATH"],"preferred_subjects":["ICT"],"notes":"Software development and network security focus"},
    {"major":"Law (LLB)","jupas_code":"JS2462","minimum_score":13,"average_score":16,"required_subjects":["ENGL"],"preferred_subjects":[],"notes":"Common law curriculum; evening sessions available"},
    {"major":"Public Administration","jupas_code":"JS2631","minimum_score":12,"average_score":14,"required_subjects":["ENGL"],"preferred_subjects":["ECON","HIST"],"notes":"Government and NGO sector focus"},
    {"major":"Early Childhood Education","jupas_code":"JS2512","minimum_score":12,"average_score":14,"required_subjects":["ENGL"],"preferred_subjects":[],"notes":"Registered teacher qualification pathway"},
    {"major":"Health Studies","jupas_code":"JS2322","minimum_score":12,"average_score":14,"required_subjects":["ENGL"],"preferred_subjects":["BIOL","HMSC"],"notes":"Allied health and community health focus"},
    {"major":"English Studies","jupas_code":"JS2401","minimum_score":12,"average_score":14,"required_subjects":["ENGL"],"preferred_subjects":["ENLIT"],"notes":"Language and professional communication tracks"}
  ]',
  'training_knowledge',
  '2024-01-01',
  NOW(), NOW()
),

-- ============================================================
-- 9. Hang Seng University of Hong Kong (HSUHK)
--    UUID: 20000000-0000-0000-0000-000000000009
-- ============================================================
(
  '20000000-0000-0000-0000-000000000009',
  'Hang Seng University of Hong Kong',
  '香港恒生大學',
  'UNIVERSITY',
  'Siu Lek Yuen, Sha Tin',
  'https://www.hsu.edu.hk',
  'Formerly Hang Seng Management College, HSUHK gained full university status in 2018. It focuses on professional education in business, communication, translation, and computing, with a strong emphasis on practical skills and community engagement.',
  13,
  '[{"code":"CHLA","min_grade":"2"},{"code":"ENGL","min_grade":"2"},{"code":"MATH","min_grade":"1"},{"code":"CSD","min_grade":"1"}]',
  '{"ielts_minimum":5.5}',
  '["Accountancy","Business Administration","Communication","Translation","Computing","Supply Chain Management","Data Science","Finance"]',
  '["School of Business","School of Communication","School of Decision Sciences","School of Humanities and Languages","School of Translation"]',
  0.50,
  15.0,
  FALSE,
  FALSE,
  '[
    {"major":"Accountancy","jupas_code":"JS2811","minimum_score":13,"average_score":16,"required_subjects":["MATH"],"preferred_subjects":["BAFS"],"notes":"HKICPA-recognised; CPA fast-track available"},
    {"major":"Business Administration","jupas_code":"JS2802","minimum_score":13,"average_score":16,"required_subjects":["ENGL"],"preferred_subjects":["ECON","BAFS"],"notes":"Entrepreneurship and international business tracks"},
    {"major":"Marketing","jupas_code":"JS2815","minimum_score":13,"average_score":15,"required_subjects":["ENGL"],"preferred_subjects":["ECON","BAFS"],"notes":"Digital marketing focus; industry project-based learning"},
    {"major":"Communication","jupas_code":"JS2902","minimum_score":13,"average_score":15,"required_subjects":["ENGL"],"preferred_subjects":["CHLA"],"notes":"Journalism, PR, and media production tracks"},
    {"major":"Translation and Interpreting","jupas_code":"JS2911","minimum_score":13,"average_score":15,"required_subjects":["ENGL","CHLA"],"preferred_subjects":[],"notes":"Chinese-English and Japanese-English; interpreting labs"},
    {"major":"Computing","jupas_code":"JS2801","minimum_score":13,"average_score":15,"required_subjects":["MATH"],"preferred_subjects":["ICT"],"notes":"Software engineering and network administration"},
    {"major":"Data Science","jupas_code":"JS2891","minimum_score":13,"average_score":15,"required_subjects":["MATH"],"preferred_subjects":["ICT","M1"],"notes":"Business analytics and machine learning tracks"},
    {"major":"Supply Chain Management","jupas_code":"JS2822","minimum_score":13,"average_score":15,"required_subjects":["MATH"],"preferred_subjects":["ECON","BAFS"],"notes":"Logistics and procurement focus; industry mentorship"},
    {"major":"Finance","jupas_code":"JS2813","minimum_score":13,"average_score":16,"required_subjects":["MATH"],"preferred_subjects":["ECON","BAFS"],"notes":"Investment and fintech tracks"},
    {"major":"Chinese Language and Literature","jupas_code":"JS2921","minimum_score":13,"average_score":15,"required_subjects":["CHLA"],"preferred_subjects":["CHIL","CHIH"],"notes":"Classical and modern literature; teaching pathway available"}
  ]',
  'training_knowledge',
  '2024-01-01',
  NOW(), NOW()
),

-- ============================================================
-- 10. The Education University of Hong Kong (EdUHK)
--     UUID: 20000000-0000-0000-0000-000000000010
-- ============================================================
(
  '20000000-0000-0000-0000-000000000010',
  'The Education University of Hong Kong',
  '香港教育大學',
  'UNIVERSITY',
  'Tai Po, New Territories',
  'https://www.eduhk.hk',
  'Established in 1994 (formerly Hong Kong Institute of Education), EdUHK is the sole teacher education-focused university in Hong Kong. It has expanded its offerings to include sports science, counselling, creative arts, and environmental studies alongside its flagship teacher preparation programmes.',
  12,
  '[{"code":"CHLA","min_grade":"2"},{"code":"ENGL","min_grade":"2"},{"code":"MATH","min_grade":"1"},{"code":"CSD","min_grade":"1"}]',
  '{"ielts_minimum":5.5}',
  '["Primary Education","Early Childhood Education","Special Education","Counselling and Psychological Studies","Sports Science","Creative Arts and Culture","Environmental Studies","Chinese Language Education"]',
  '["Faculty of Education and Human Development","Faculty of Humanities","Faculty of Liberal Arts and Social Sciences","Faculty of Science and Technology"]',
  0.50,
  15.5,
  TRUE,
  FALSE,
  '[
    {"major":"Primary Education (BEd)","jupas_code":"JS9512","minimum_score":15,"average_score":18,"required_subjects":["ENGL","CHLA"],"preferred_subjects":[],"notes":"Government-funded teacher registration pathway; interview required"},
    {"major":"Early Childhood Education (BEd)","jupas_code":"JS9522","minimum_score":14,"average_score":17,"required_subjects":["ENGL"],"preferred_subjects":[],"notes":"Registered kindergarten teacher qualification; practicum embedded"},
    {"major":"Special Education (BEd)","jupas_code":"JS9532","minimum_score":14,"average_score":17,"required_subjects":["ENGL"],"preferred_subjects":["HLTH","HMSC"],"notes":"Focus on inclusive education; SEN specialist qualification"},
    {"major":"Secondary Education — English Language (BEd)","jupas_code":"JS9542","minimum_score":15,"average_score":18,"required_subjects":["ENGL"],"preferred_subjects":["ENLIT"],"notes":"QTS-equivalent; high demand for qualified English teachers"},
    {"major":"Secondary Education — Mathematics (BEd)","jupas_code":"JS9552","minimum_score":15,"average_score":18,"required_subjects":["MATH"],"preferred_subjects":["M1","M2"],"notes":"STEM education focus; secondary school placement"},
    {"major":"Counselling and Psychological Studies","jupas_code":"JS9622","minimum_score":14,"average_score":17,"required_subjects":["ENGL"],"preferred_subjects":["BIOL"],"notes":"School counselling focus; accreditation pathway for HKPS"},
    {"major":"Sports Science","jupas_code":"JS9412","minimum_score":13,"average_score":16,"required_subjects":["ENGL"],"preferred_subjects":["PE","BIOL"],"notes":"Physical education teacher track and sports management track"},
    {"major":"Creative Arts and Culture","jupas_code":"JS9532","minimum_score":13,"average_score":16,"required_subjects":["ENGL"],"preferred_subjects":["VART","MUSC"],"notes":"Arts education and community arts tracks; portfolio interview"},
    {"major":"Environmental Studies","jupas_code":"JS9801","minimum_score":13,"average_score":16,"required_subjects":["ENGL"],"preferred_subjects":["GEOG","BIOL","CHEM"],"notes":"Sustainability and environmental education focus"},
    {"major":"Chinese Language Education (BEd)","jupas_code":"JS9562","minimum_score":14,"average_score":17,"required_subjects":["CHLA"],"preferred_subjects":["CHIL","CHIH"],"notes":"Mandarin teaching track available; secondary school placement"},
    {"major":"Information Technology in Education","jupas_code":"JS9101","minimum_score":13,"average_score":16,"required_subjects":["MATH"],"preferred_subjects":["ICT"],"notes":"EdTech and digital learning design focus"}
  ]',
  'training_knowledge',
  '2024-01-01',
  NOW(), NOW()
)

ON CONFLICT (name) DO UPDATE SET
  major_requirements = EXCLUDED.major_requirements,
  minimum_entry_score = EXCLUDED.minimum_entry_score,
  average_admitted_score = EXCLUDED.average_admitted_score,
  acceptance_rate = EXCLUDED.acceptance_rate,
  notable_programs = EXCLUDED.notable_programs,
  data_source = EXCLUDED.data_source,
  data_last_updated = EXCLUDED.data_last_updated,
  updated_at = NOW();

-- =============================================================================
-- End of seed_schools.sql
-- Total schools: 10
-- Total programs (major_requirements entries): 113
-- Institutions: HKU(12) CUHK(12) HKUST(12) PolyU(12) CityU(12)
--               HKBU(12) Lingnan(10) HKMU(10) HSUHK(10) EdUHK(11)
-- =============================================================================
