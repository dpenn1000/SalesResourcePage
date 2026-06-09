# Per-section thumbnail generator v2: saturated section colors + per-section fonts.
$OUT = 'C:\Users\dan\repos\SalesResourcePage\Index Photos'
function esc($s){ return ($s -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;') }

# Title fonts (one per section, web-safe with fallbacks). $SAN stays for eyebrow/subtitle.
$SAN="'Helvetica Neue',Arial,sans-serif"
$PAL="'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif"      # University - elegant academic
$CAM="Cambria,Constantia,Georgia,'Times New Roman',serif"             # Roofing - sturdy slab-ish serif
$TNR="'Times New Roman',Times,Georgia,serif"                          # Finance - classic formal serif
$CGO="'Century Gothic','Avant Garde','Trebuchet MS',sans-serif"       # Solar - bright geometric
$BAH="Bahnschrift,'Franklin Gothic Medium','Arial Narrow',Arial,sans-serif" # Battery - industrial DIN
$FRK="'Franklin Gothic Medium','Arial Narrow','Arial Black',Arial,sans-serif" # Field Mastery - strong
$VER="Verdana,Geneva,'DejaVu Sans',sans-serif"                        # Reference - clean legible
$ABL="'Arial Black','Arial Bold',Impact,Arial,sans-serif"            # Control - heavy/bold
$TAH="Tahoma,Geneva,Verdana,sans-serif"                               # Ticket - utilitarian
$TRE="'Trebuchet MS','Segoe UI',sans-serif"                           # Management - friendly corporate
$CON="Consolas,'Courier New',ui-monospace,monospace"                 # Technology - mono
$CAN="Candara,'Gill Sans','Gill Sans MT','Segoe UI',sans-serif"       # Customer Experience - warm humanist
$CAL="Calibri,'Segoe UI',Corbel,Arial,sans-serif"                    # HR - soft professional

# Motifs (top-right ~170px, url(#acc); {BG}=bg1)
$M = @{
 mortarboard='<g transform="translate(966,92)"><polygon points="92,6 182,44 92,82 2,44" fill="url(#acc)"/><path d="M34,56 V96 Q92,124 150,96 V56" fill="none" stroke="url(#acc)" stroke-width="7"/><circle cx="92" cy="44" r="7" fill="{BG}"/><line x1="182" y1="44" x2="182" y2="104" stroke="url(#acc)" stroke-width="5"/><circle cx="182" cy="110" r="8" fill="url(#acc)"/></g>'
 sun='<g transform="translate(1000,100)"><circle cx="60" cy="60" r="30" fill="url(#acc)"/><g stroke="url(#acc)" stroke-width="8" stroke-linecap="round"><line x1="60" y1="0" x2="60" y2="20"/><line x1="60" y1="100" x2="60" y2="120"/><line x1="0" y1="60" x2="20" y2="60"/><line x1="100" y1="60" x2="120" y2="60"/><line x1="15" y1="15" x2="30" y2="30"/><line x1="90" y1="90" x2="105" y2="105"/><line x1="105" y1="15" x2="90" y2="30"/><line x1="30" y1="90" x2="15" y2="105"/></g></g>'
 roof='<g transform="translate(972,108)" fill="none" stroke="url(#acc)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M8,74 L88,14 L168,74"/><path d="M30,82 L88,40 L146,82"/></g>'
 battery='<g transform="translate(966,96)"><rect x="0" y="6" width="150" height="92" rx="16" fill="none" stroke="url(#acc)" stroke-width="7"/><rect x="150" y="36" width="16" height="32" rx="5" fill="url(#acc)"/><path d="M84,16 L44,60 H72 L60,90 L108,42 H78 Z" fill="url(#acc)"/></g>'
 coin='<g transform="translate(992,100)"><circle cx="60" cy="60" r="56" fill="none" stroke="url(#acc)" stroke-width="7"/><text x="60" y="88" text-anchor="middle" font-family="Georgia,serif" font-size="74" font-weight="700" fill="url(#acc)">$</text></g>'
 target='<g transform="translate(992,100)" fill="none" stroke="url(#acc)" stroke-width="7"><circle cx="58" cy="58" r="54"/><circle cx="58" cy="58" r="32"/><circle cx="58" cy="58" r="10" fill="url(#acc)"/></g>'
 book='<g transform="translate(972,108)" fill="none" stroke="url(#acc)" stroke-width="6" stroke-linejoin="round"><path d="M90,18 C60,2 22,8 8,16 V100 C22,92 60,86 90,100 C120,86 158,92 172,100 V16 C158,8 120,2 90,18 Z"/><line x1="90" y1="18" x2="90" y2="100"/></g>'
 chartup='<g transform="translate(984,96)"><g fill="url(#acc)"><rect x="0" y="74" width="26" height="46" rx="3"/><rect x="42" y="46" width="26" height="74" rx="3"/><rect x="84" y="18" width="26" height="102" rx="3"/></g><path d="M8,62 L52,34 L96,8" fill="none" stroke="url(#acc)" stroke-width="6"/><path d="M76,8 H98 V30" fill="none" stroke="url(#acc)" stroke-width="6"/></g>'
 ticket='<g transform="rotate(-10 980 360)" opacity="0.16"><rect x="812" y="150" width="360" height="350" rx="26" fill="none" stroke="url(#acc)" stroke-width="6"/><line x1="952" y1="160" x2="952" y2="490" stroke="url(#acc)" stroke-width="4" stroke-dasharray="16 13"/><circle cx="952" cy="150" r="22" fill="{BG}"/><circle cx="952" cy="500" r="22" fill="{BG}"/></g><g transform="translate(998,104)"><rect x="0" y="0" width="156" height="66" rx="14" fill="none" stroke="url(#acc)" stroke-width="5"/><line x1="56" y1="7" x2="56" y2="59" stroke="url(#acc)" stroke-width="4" stroke-dasharray="9 7"/><circle cx="118" cy="33" r="9" fill="url(#acc)"/></g>'
 nodes='<g transform="translate(976,98)" stroke="url(#acc)" stroke-width="5" fill="url(#acc)"><line x1="90" y1="22" x2="30" y2="100"/><line x1="90" y1="22" x2="150" y2="100"/><circle cx="90" cy="22" r="16"/><circle cx="30" cy="100" r="16"/><circle cx="150" cy="100" r="16"/></g>'
 circuit='<g transform="translate(976,96)" stroke="url(#acc)" stroke-width="5" fill="none"><path d="M30,42 V72 H90 V102"/><path d="M150,42 V72 H90"/><circle cx="30" cy="30" r="12" fill="url(#acc)"/><circle cx="150" cy="30" r="12" fill="url(#acc)"/><circle cx="90" cy="114" r="12" fill="url(#acc)"/></g>'
 envelope='<g transform="translate(974,108)" fill="none" stroke="url(#acc)" stroke-width="6" stroke-linejoin="round"><rect x="0" y="0" width="172" height="112" rx="12"/><path d="M4,10 L86,66 L168,10"/></g>'
 people='<g transform="translate(975,96)" fill="url(#acc)"><circle cx="110" cy="50" r="18" opacity="0.6"/><path d="M84,128 a28,34 0 0 1 56,0 Z" opacity="0.6"/><circle cx="52" cy="40" r="24"/><path d="M14,128 a40,46 0 0 1 76,0 Z"/></g>'
}

# Theme: bg1(dark), bg2(vivid), acc1, acc2, eyebrow, sub, c1, c2, motif, font, wf, cap
$T = @{
 university   = @('#1E1545','#46297E','#F2D785','#D9A93E','#EDD58A','#C9BD93','#B98CFF','#E8C66B','mortarboard',$PAL,0.53,110)
 solar        = @('#0A2E5A','#1E73C0','#FFC83D','#FFE08A','#FFD980','#BAD6F2','#FFC83D','#36B0F0','sun',$CGO,0.62,98)
 roofing      = @('#2B313B','#5A6675','#F08A3C','#FFB85A','#F4B27A','#C7CFD9','#F08A3C','#8A97A6','roof',$CAM,0.50,110)
 battery      = @('#073A2A','#11B070','#B6F24A','#39E0A6','#A6F0C2','#BEEAD2','#39E0A6','#2BC07E','battery',$BAH,0.47,110)
 finance      = @('#0C3526','#18794E','#F0D27A','#D4AA48','#EBD79A','#B6D8C2','#F0D27A','#2FA86A','coin',$TNR,0.50,110)
 fieldmastery = @('#11294A','#1E5BA0','#8BE04A','#36C0E8','#B6CBE0','#AEC2DA','#36C0E8','#8BE04A','target',$FRK,0.50,108)
 reference    = @('#0E3340','#1C7E86','#36C9D8','#7AE0C8','#9AD8E0','#AEC8CE','#36C9D8','#2A8E96','book',$VER,0.62,96)
 control      = @('#10283A','#1E6E92','#FF9A3C','#FFC04E','#FFC080','#AEC2D6','#FF9A3C','#2E86A6','chartup',$ABL,0.62,98)
 ticket       = @('#103246','#1E86B0','#34C0E8','#6EE0D2','#8FD6EC','#AED2DE','#34C0E8','#2A7A96','ticket',$TAH,0.54,92)
 management   = @('#1E2450','#3E48A0','#9AA6FF','#6ED0E8','#B8BEF8','#AEB6D6','#9AA6FF','#4A56B0','nodes',$TRE,0.55,104)
 tech         = @('#061A30','#0E5288','#2EE6FF','#5BE0A0','#6FE6F0','#9FC2D6','#2EE6FF','#1E6E9E','circuit',$CON,0.56,86)
 cx           = @('#34164A','#8A2E7E','#FF8A3C','#FF5BA8','#FFA6C8','#D6B6CE','#FF5BA8','#7A3E9E','envelope',$CAN,0.52,104)
 hr           = @('#143038','#2C6E72','#62D0C8','#8AE0A0','#8FD8D0','#AEC8C8','#62D0C8','#2C6E72','people',$CAL,0.50,104)
}

function FitFont($lines,$wf,$cap){ $m=0; foreach($l in $lines){ if($l.Length -gt $m){$m=$l.Length} }; if($m -lt 1){$m=1}; $fit=[int]([math]::Floor(1040.0/($m*$wf))); if($fit -gt $cap){return $cap}; return $fit }

function Build($th,$eyebrow,$lines,$subtitle,$motifKey){
 $t=$T[$th]; $bg1=$t[0];$bg2=$t[1];$a1=$t[2];$a2=$t[3];$eb=$t[4];$sb=$t[5];$c1=$t[6];$c2=$t[7];$ff=$t[9];$wf=$t[10];$cap=$t[11]
 $mk = if($motifKey){$motifKey}else{$t[8]}
 $motif = ($M[$mk] -replace '\{BG\}',$bg1)
 $font = FitFont $lines $wf $cap
 $y1 = if($lines.Count -eq 1){430}else{372}
 $gap = [int]([math]::Round($font*1.08))
 $titleSvg=''
 for($i=0;$i -lt $lines.Count;$i++){ $yy=$y1+($i*$gap); $titleSvg += "<text x=`"84`" y=`"$yy`" fill=`"#FFFFFF`" font-family=`"$ff`" font-size=`"$font`" font-weight=`"700`">$(esc $lines[$i])</text>" }
 $rule = if($th -eq 'university' -or $th -eq 'finance'){ $ry=$y1+($lines.Count-1)*$gap+30; "<rect x=`"86`" y=`"$ry`" width=`"330`" height=`"3`" rx=`"2`" fill=`"url(#acc)`" opacity=`"0.6`"/>" } else { '' }
 $ebSize = if($th -eq 'ticket'){31}else{34}
 @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="0.85"><stop offset="0" stop-color="$bg1"/><stop offset="1" stop-color="$bg2"/></linearGradient>
<linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="$a1"/><stop offset="1" stop-color="$a2"/></linearGradient>
<radialGradient id="shade" cx="0.28" cy="0.55" r="0.85"><stop offset="0" stop-color="$bg1" stop-opacity="0.92"/><stop offset="1" stop-color="$bg1" stop-opacity="0"/></radialGradient></defs>
<rect width="1200" height="675" fill="url(#bg)"/>
<circle cx="1015" cy="150" r="250" fill="$c1" opacity="0.16"/><circle cx="175" cy="600" r="230" fill="$c2" opacity="0.18"/>
<rect width="760" height="675" fill="url(#shade)"/>
$motif
<text x="92" y="208" fill="$eb" font-family="$SAN" font-size="$ebSize" font-weight="700" letter-spacing="9">$(esc $eyebrow)</text>
<rect x="92" y="234" width="150" height="9" rx="4" fill="url(#acc)"/>
$titleSvg$rule
<text x="92" y="582" fill="$sb" font-family="$SAN" font-size="32" font-weight="600" letter-spacing="2">$(esc $subtitle)</text>
</svg>
"@
}

$cards = @(
 @('university','university','UNIVERSITY','Traditional','University','The curriculum that builds closers',''),
 @('new-hire','university','UNIVERSITY','New Hire','Process','Your first days, step by step',''),
 @('solar-objections','solar','SOLAR','Solar','Objections','Study / Drill / Quiz',''),
 @('kill-the-bill','solar','SOLAR','Kill','the Bill','Wipe out the electric bill',''),
 @('one-touch-close','solar','SOLAR','One-Touch','Close','Presentation to prescription',''),
 @('selling-the-rate','solar','SOLAR','Selling','the Rate','Conviction on the escalator',''),
 @('rate-escalator','solar','SOLAR','The Rate','Escalator','The cost of doing nothing',''),
 @('goodleap-portal','solar','SOLAR FINANCING','GoodLeap','Portal','Submit and track loans',''),
 @('sunlight-portal','solar','SOLAR FINANCING','Sunlight','Portal','Submit and track loans',''),
 @('service-finance-portal','solar','SOLAR FINANCING','Service','Finance','Submit and track loans',''),
 @('palmetto-lightreach','solar','SOLAR FINANCING','Palmetto','LightReach','PPA and lease deals',''),
 @('roofing-objections','roofing','ROOFING','Roofing','Objections','Study / Drill / Quiz',''),
 @('price-conditioning','roofing','ROOFING','Price','Conditioning','Frame the roof investment',''),
 @('iko-roofing','roofing','ROOFING','IKO Roofing','One Pager','Shingles, specs, and the pitch',''),
 @('roofing-knowledge-base','roofing','ROOFING','Roofing','Knowledge','Old but great reference',''),
 @('product-knowledge','roofing','ROOFING','Roofing','Product','Shingles and materials',''),
 @('competitive-advantage','roofing','ROOFING','Competitive','Advantage','Why Trinity roofing wins',''),
 @('ess-state-program','battery','BATTERY','ESS State','Program','CT incentive, how it pays',''),
 @('ess-calculator','battery','BATTERY','ESS','Calculator','Size it, model the incentive',''),
 @('grid-edge-checker','battery','BATTERY','Grid Edge','Checker','Eversource / UI eligibility',''),
 @('battery-rebate','battery','BATTERY','Battery','Rebate','Powerwall promo',''),
 @('ct-ess-mou','battery','BATTERY FORM','CT ESS','MOU','Customer enrollment agreement',''),
 @('low-income-affidavit','battery','BATTERY FORM','Low Income','Affidavit','Qualify the incentive tier',''),
 @('low-income-verification','battery','BATTERY FORM','Low Income','Verification','Confirm eligibility',''),
 @('ess-terms-conditions','battery','BATTERY FORM','ESS Terms','& Conditions','What the customer acknowledges',''),
 @('contractor-resources','battery','BATTERY','Contractor','Resources','Installer specs and docs',''),
 @('credit-conversation','finance','FINANCE','The Credit','Conversation','When credit says no',''),
 @('titlework','finance','FINANCE','Understanding','Title Work','Get the right signer on title',''),
 @('whats-the-catch','finance','FINANCE','What''s the','Catch','The honest version of solar',''),
 @('our-heavy-lifting','finance','FINANCE','Our Heavy','Lifting','What we carry for 25 years',''),
 @('lightreach-ppa-practice','finance','FINANCE','LightReach PPA','Practice Copy','Annotated, end to end',''),
 @('lightreach-ppa-walkthrough','finance','FINANCE','Walk the','LightReach PPA','Section by section',''),
 @('cognitive-bias','fieldmastery','FIELD MASTERY','Cognitive','Biases','The psychology of yes',''),
 @('door-resistance','fieldmastery','FIELD MASTERY','Door','Resistance','Turn the door into a sit',''),
 @('know-your-buyer','fieldmastery','FIELD MASTERY','Know Your','Buyer','Sell to every personality',''),
 @('know-your-style','fieldmastery','FIELD MASTERY','Know Your','Style','Find your DISC style',''),
 @('roleplay-app','fieldmastery','FIELD MASTERY','Roleplay','App','Practice before the door',''),
 @('sales-ops-master-reference','reference','REFERENCE','Sales Ops','Master Ref','SOP, pricing, checklists',''),
 @('market-data','reference','REFERENCE','Why','Trinity','Market data and credibility',''),
 @('video-library','reference','REFERENCE','Video','Library','Watch / Search / Reference',''),
 @('install-gallery','reference','REFERENCE','Installation','Gallery','Real Trinity installs',''),
 @('constant-contact','cx','CUSTOMER EXPERIENCE','Constant','Contact','Touches / Cadence / Referrals',''),
 @('call-list-guide','control','CONTROL YOUR BUSINESS','Call List','Playbook','Work your leads the right way',''),
 @('call-list','control','CONTROL YOUR BUSINESS','Your','Call List','Work the leads, book the sit',''),
 @('community-program-overview','control','CONTROL YOUR BUSINESS','Communities','Program','$836,150 raised since 2018',''),
 @('community-event-playbook','control','CONTROL YOUR BUSINESS','Event','Playbook','Set up / Capture / Sit / Close',''),
 @('commission-dashboard','control','CONTROL YOUR BUSINESS','Commission','Dashboard','Track every paycheck',''),
 @('appointment-transfer','ticket','MANAGEMENT / TICKET','Appointment','Transfer','Move an appointment / Helpdesk',''),
 @('setup-skedulo-resource','ticket','MANAGEMENT / TICKET','Set Up a New','Skedulo Resource','New rep onboarding / Helpdesk',''),
 @('shift-calendar-change','ticket','MANAGEMENT / TICKET','Shift / Calendar','Change','Hours, blocks, time off',''),
 @('skedulo-status-update','ticket','MANAGEMENT / TICKET','Skedulo Status','Update','Activate / deactivate access',''),
 @('traditional-rep-transfer','hr','MANAGEMENT / HR','Traditional Rep','Transfer','Move a rep between offices',''),
 @('offboard-rep','hr','MANAGEMENT / HR','Offboard','a Rep','Clean exit checklist / Rep 360',''),
 @('departments-communications','management','MANAGEMENT','Departments &','Communications','Who does what, how to reach',''),
 @('org-chart-explorer','management','MANAGEMENT','Org Chart','Explorer','Live, connected org / Preview',''),
 @('viper-ranking-overview','management','MANAGEMENT','Viper Rep','Ranking','Scored / Ranked / Dispatched',''),
 @('onecal-scheduling','management','MANAGEMENT','OneCal','Scheduling','Shifts, calendars, coverage',''),
 @('onebutton-top-10','tech','TECHNOLOGY','oneBUTTON','Top 10','What breaks, and the fix','circuit')
)

$n=0
foreach($c in $cards){
 $lines = if($c[4] -and $c[4].Trim() -ne ''){ ,$c[3]+$c[4] } else { ,$c[3] }
 $svg = Build $c[1] $c[2] $lines $c[5] $c[6]
 [System.IO.File]::WriteAllText((Join-Path $OUT ($c[0]+'-thumbnail.svg')), $svg, (New-Object System.Text.UTF8Encoding($false)))
 $n++
}
"Generated $n thumbnails (v2: saturated + per-section fonts)."
