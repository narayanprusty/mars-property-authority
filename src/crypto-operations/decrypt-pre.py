import base64
import sys
from umbral import pre, keys
from umbral.kfrags import KFrag
from umbral.config import default_curve
from umbral.params import UmbralParameters

encoded_kfrags = sys.argv[1].split(',')
for idx, row in enumerate(encoded_kfrags):
    encoded_kfrags[idx] = KFrag.from_bytes(base64.b64decode(row))
kfrags = tuple(encoded_kfrags)

params = UmbralParameters(default_curve())
capsule = pre.Capsule.from_bytes(base64.b64decode(sys.argv[2]), params)
ciphertext = base64.b64decode(sys.argv[3])
bobs_private_key = keys.UmbralPrivateKey.from_bytes(base64.b64decode(sys.argv[4]))
bobs_public_key = keys.UmbralPublicKey.from_bytes(base64.b64decode(sys.argv[5]))
alice_public_key = keys.UmbralPublicKey.from_bytes(base64.b64decode(sys.argv[6]))

capsule.set_correctness_keys(alice_public_key, bobs_public_key, alice_public_key)

for kfrag in kfrags:
    cfrag = pre.reencrypt(kfrag, capsule)
    capsule.attach_cfrag(cfrag)

cleartext = pre.decrypt(ciphertext, capsule, bobs_private_key, alice_public_key)
print(cleartext)
