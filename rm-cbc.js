// Royal Mail Customer Barcode Decoder
// You may use this code for any purpose, with no restrictions. However,
// there is NO WARRANTY for this code; use it at your own risk. This work
// is released under the Creative Commons Zero License. To view a copy of
// this license, visit http://creativecommons.org/publicdomain/zero/1.0/

// Determine whether a 4-bit group is valid. Each group of 4 bars defines
// two 4-bit groups: the tops of the bars and the bottoms. Valid groups
// have exactly two of the four bits set. There are 6 different valid
// 4-bit groups, so each group of 4 bars has 6*6=36 valid combinations.
// This table contains 0 for valid groups. For invalid groups, the table
// provides a 4-bit value which indicates which bits of the group are most
// likely to be in error (assuming a single bit error is more likely).
var group_table = [ 15, 14, 13, 0, 11, 0, 0, 7, 7, 0, 0, 11, 0, 13, 14, 15 ];

function clean_str(str) {
   if (str == null) str = '';
   return str.toUpperCase().replace(/\s/g, '');
}

function decode_barcode(barcode) {
   var inf = { message: '', postcode: '', delivery_pt: '' };

   var len = barcode.length;
   inf.bad_bar = new Array(len);
   if (len == 0) return inf;

   if (barcode.charAt(0) != 'A') {
      inf.message = 'Incorrect starting bar';
      inf.bad_bar[0] = 1;
      return inf;
   }

   var pos, decoded = '', error = 0;
   var top, btm, top_sum = 0, btm_sum = 0;
   for (pos = 1; pos+4 <= len; pos += 4) {
      // Sum up the 4 bars in this group
      var i, bad_grp = 0;
      top = btm = 0;
      for (i = 0; i < 4; i++) {
         switch (barcode.charAt(pos+i)) {
            case 'T':  case 'S':
               break;
            case 'A':
               top |= 8 >> i;
               break;
            case 'D':
               btm |= 8 >> i;
               break;
            case 'F':
               top |= 8 >> i;
               btm |= 8 >> i;
               break;
            default:
               inf.bad_bar[pos+i] = 1;
               error = bad_grp = 1;
               break;
         }
      }

      if (bad_grp) {
         // This group contains one or more invalid bars
         decoded += '?';
      }
      else if (bad_grp = group_table[top] | group_table[btm]) {
         // This group doesn't satisfy the two-of-four rule.
         // Flag the most likely error locations.
         error = 1;
         for (i = 0; i < 4; i++) {
           if (bad_grp & (8 >> i))
             inf.bad_bar[pos+i] = 1;
         }
         decoded += '?';
      }
      else {
         // Valid group. Discard low bit from top and btm, as it can
         // be determined by the two-of-four rule.
         top >>= 1;
         btm >>= 1;
         // Now top and btm are in the range 1 to 6, so c is 0 to 35.
         var c = top*6 + btm - 7;
         if (c < 10)
            decoded += String.fromCharCode(48 + c);  // 0-9
         else
            decoded += String.fromCharCode(55 + c);  // A-Z
         top_sum += top;
         btm_sum += btm;
      }
   }
   inf.postcode = decoded;

   if (error)
      inf.message = 'Damaged barcode';
   else if (len > 42)
      inf.message = 'Barcode too long';
   else if (len >= 34 && pos+1 == len && barcode.charAt(pos) == 'F') {
      var dlen = decoded.length;
      inf.postcode = decoded.substring(0, dlen-3);
      inf.delivery_pt = decoded.substring(dlen-3, dlen-1);
      // See if check digit matches. We want the sum of digits 1 to n-1
      // to match digit n (mod 6). Since we've already calculated the
      // sum of digits 1 to n, subtract twice digit n and the result
      // should be zero (mod 6).
      top_sum -= top << 1;
      btm_sum -= btm << 1;
      if (top_sum % 6 == 0 && btm_sum % 6 == 0)
         inf.message = 'Valid barcode';
      else
         inf.message = 'Incorrect check digit';
   }
   else
      inf.message = 'Incomplete barcode';

   return inf;
}

function make_quad(top, btm) {
   // Construct four bars to represent a character.
   // Top and btm are the tops and bottoms of the bars, ranging from 1 to 6.
   // First, set the low bits so the 2 of 4 rule is satisfied.
   top <<= 1;
   btm <<= 1;
   if (group_table[top]) top++;
   if (group_table[btm]) btm++;
   var barcode = '';
   // Loop through four bits...
   for (var mask = 8; mask; mask >>= 1) {
      if (top & mask)
         barcode += (btm & mask) ? 'F' : 'A';
      else
         barcode += (btm & mask) ? 'D' : 'T';
   }
   return barcode;
}

function encode_barcode(postcode, delivery_pt) {
   var inf = new Object();

   if (postcode.length < 5 || postcode.length > 7)
      inf.message = 'Postcode must be between 5 and 7 characters long';
   else if (delivery_pt.length != 2)
      inf.message = 'Delivery point must be 2 characters long';
   else
      inf.message = '';

   inf.barcode = 'A';
   var top, btm, top_sum = 0, btm_sum = 0;
   var code = postcode + delivery_pt;
   for (var i = 0; i < code.length; i++) {
      // Get character to encode, in range 0-35
      var c = code.charCodeAt(i);
      if (c < 58)
         c -= 48;  // 0-9
      else
         c -= 55;  // A-Z
      // Calculate top and btm in range 1 to 6
      top = Math.floor(c / 6) + 1;
      btm = c % 6 + 1;
      inf.barcode += make_quad(top, btm);
      top_sum += top;
      btm_sum += btm;
   }

   if (inf.message == '') {
      // Add the check digit. Need to get top and btm in range 1 to 6,
      // but without changing the value mod 6.
      top = (top_sum - 1) % 6 + 1;
      btm = (btm_sum - 1) % 6 + 1;
      inf.barcode += make_quad(top, btm) + 'F';
      inf.message = 'Valid barcode';
   }

   return inf;
}

function show_barcode(barcode, bad_bar) {
   var top = document.getElementById('row0').cells;
   var mid = document.getElementById('row1').cells;
   var btm = document.getElementById('row2').cells;
   var len = barcode.length;
   if (len > 42) len = 42;
   var i, c;
   for (i = 0; i < len; i++) {
      if (bad_bar && bad_bar[i])
         c = '#f00';
      else
         c = '#000';
      switch (barcode.charAt(i)) {
         case 'A':
            top[i].style.backgroundColor = c;
            mid[i].style.backgroundColor = c;
            btm[i].style.backgroundColor = 'transparent';
            break;
         case 'D':
            top[i].style.backgroundColor = 'transparent';
            mid[i].style.backgroundColor = c;
            btm[i].style.backgroundColor = c;
            break;
         case 'F':
            top[i].style.backgroundColor = c;
            mid[i].style.backgroundColor = c;
            btm[i].style.backgroundColor = c;
            break;
         case 'T':  case 'S':
            top[i].style.backgroundColor = 'transparent';
            mid[i].style.backgroundColor = c;
            btm[i].style.backgroundColor = 'transparent';
            break;
         default:
            top[i].style.backgroundColor = '#f00';
            mid[i].style.backgroundColor = '#f00';
            btm[i].style.backgroundColor = '#f00';
            break;
      }
   }
   for (i = len; i < 34; i++) {
      top[i].style.backgroundColor = 'transparent';
      mid[i].style.backgroundColor = '#ccc';
      btm[i].style.backgroundColor = 'transparent';
   }
   for (; i < 42; i++) {
      top[i].style.backgroundColor = 'transparent';
      mid[i].style.backgroundColor = '#eee';
      btm[i].style.backgroundColor = 'transparent';
   }
}

function do_decode() {
   var barcode = clean_str(document.forms.decode_form.barcode.value);

   var inf = decode_barcode(barcode);
   show_barcode(barcode, inf.bad_bar);

   document.getElementById('message_span').innerHTML = inf.message;
   if ('postcode' in inf)
      document.forms.encode_form.postcode.value = inf.postcode;
   if ('delivery_pt' in inf)
      document.forms.encode_form.delivery_pt.value = inf.delivery_pt;
}

function do_encode() {
   var postcode = clean_str(document.forms.encode_form.postcode.value);
   var delivery_pt = clean_str(document.forms.encode_form.delivery_pt.value);

   var inf = encode_barcode(postcode, delivery_pt);

   document.getElementById('message_span').innerHTML = inf.message;
   if ('barcode' in inf) {
      document.forms.decode_form.barcode.value = inf.barcode;
      show_barcode(inf.barcode);
   }
}

